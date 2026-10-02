import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import EnTete from '../../components/EnTete';
import PanneauModificationEtudiant from './PanneauModificationEtudiant';
import PanneauChangementClasse from './PanneauChangementClasse';
import PanneauAffectationClasse from './PanneauAffectationClasse';
import {
  obtenirEtudiantParId,
  obtenirHistoriqueAbsences,
  obtenirNotesInscription,
  supprimerEtudiant,
  bloquerEtudiant,
  debloquerEtudiant,
} from '../../services/etudiants.service';
import type { EtudiantAvecHistorique, NoteInscription } from '../../types/etudiants.types';
import { calculerEtatAnnee } from '../../services/lots.service';
import type { EtatAnnee } from '../../types/lots.types';
import { LABELS_STATUT_VALIDATION, CLASSES_STATUT_VALIDATION } from '../../constants/notesConstants';
import { telechargerBulletinIndividuelPdf } from '../../services/bulletins.service';
import '../../styles/listes.css';
import './FicheEtudiantPage.css';

/**
 * Une entrée d'absence, avec son contexte (semestre + année) dérivé du
 * COURS concerné, pas de l'inscription — une inscription couvre maintenant
 * l'année entière (S1 et S2), donc seul le cours sait à quel semestre
 * précis une absence appartient.
 */
interface AbsenceAvecContexte {
  id: string;
  dateSeance: string;
  cours: { code: string; titre: string };
  contexte: string; // ex. "S1 (2026-2027)"
}

/**
 * Les notes groupées par semestre (pas par inscription) — une seule
 * inscription couvre maintenant S1 et S2 ensemble, donc c'est la note
 * elle-même (via son cours) qui indique de quel semestre elle relève.
 */
interface NotesParSemestre {
  cle: string;
  contexte: string; // ex. "S1 (2026-2027)"
  notes: NoteInscription[];
}

const LIBELLE_TERME: Record<string, string> = { AUTOMNE: 'Automne', PRINTEMPS: 'Printemps', ETE: 'Été' };

const LABELS_COMPOSANTES: Record<string, string> = {
  DEVOIR_1: 'Devoir 1',
  DEVOIR_2: 'Devoir 2',
  EXPOSE: 'Exposé',
  EXAMEN_SESSION_1: 'Examen S1',
  EXAMEN_SESSION_2: 'Examen S2',
  DEVOIR: 'Devoir',
};

/**
 * Quelles colonnes de composantes afficher, et dans quel ordre — déduit
 * des données elles-mêmes plutôt que fixé à l'avance : le cycle (Licence
 * ou Master) change les colonnes de base, et "Examen S2" ne s'affiche que
 * si au moins une matière l'a réellement renseignée, jamais une colonne
 * vide pour tout le monde.
 */
function determinerColonnesComposantes(notesParSemestre: NotesParSemestre[]): string[] {
  const toutesLesNotes = notesParSemestre.flatMap((g) => g.notes);
  const premiereAvecComposantes = toutesLesNotes.find((n) => Object.keys(n.composantes).length > 0);
  if (!premiereAvecComposantes) return [];

  const colonnesBase = Object.keys(premiereAvecComposantes.composantes).filter((c) => c !== 'EXAMEN_SESSION_2');
  const besoinSession2 = toutesLesNotes.some((n) => n.composantes.EXAMEN_SESSION_2 != null);
  return besoinSession2 ? [...colonnesBase, 'EXAMEN_SESSION_2'] : colonnesBase;
}

export default function FicheEtudiantPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [etudiant, setEtudiant] = useState<EtudiantAvecHistorique | null>(null);
  const [absences, setAbsences] = useState<AbsenceAvecContexte[]>([]);
  const [notesParSemestre, setNotesParSemestre] = useState<NotesParSemestre[]>([]);
  const [dispenses, setDispenses] = useState<NoteInscription[]>([]);
  const [etatsAnneeParInscription, setEtatsAnneeParInscription] = useState<
    { inscriptionId: string; anneeLibelle: string; etat: EtatAnnee }[]
  >([]);
  const [enChargement, setEnChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [panneauModificationOuvert, setPanneauModificationOuvert] = useState(false);
  const [panneauClasseOuvert, setPanneauClasseOuvert] = useState(false);
  const [panneauAffectationOuvert, setPanneauAffectationOuvert] = useState(false);

  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [enCoursSuppression, setEnCoursSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);

  const [enCoursBlocage, setEnCoursBlocage] = useState(false);
  const [erreurBlocage, setErreurBlocage] = useState<string | null>(null);

  function chargerFiche() {
    if (!id) return;

    setEnChargement(true);
    setErreur(null);

    obtenirEtudiantParId(id)
      .then(async (donnees) => {
        setEtudiant(donnees);

        const resultatsAbsences = await Promise.all(
          donnees.inscriptions.map(async (inscription) => {
            const historique = await obtenirHistoriqueAbsences(inscription.id);
            return historique.map((absence) => ({
              id: absence.id,
              dateSeance: absence.dateSeance,
              cours: { code: absence.cours.code, titre: absence.cours.titre },
              contexte: `${absence.cours.ue.semestre.libelle} (${inscription.anneeUniversitaire.libelle})`,
            }));
          })
        );

        const toutesLesAbsences = resultatsAbsences
          .flat()
          .sort((a, b) => new Date(b.dateSeance).getTime() - new Date(a.dateSeance).getTime());

        setAbsences(toutesLesAbsences);

        // Chaque inscription (une par année/niveau) peut renvoyer des cours
        // de n'importe quel niveau du parcours (anticipés ou en retard) —
        // on regroupe donc par Terme, jamais par le semestre officiel du
        // cours, qui ne reflète plus l'ordre réel de progression.
        const groupesParSemestre = new Map<string, NotesParSemestre>();
        const dispensesTrouvees: NoteInscription[] = [];

        for (const inscription of donnees.inscriptions) {
          const notes = await obtenirNotesInscription(inscription.id);
          for (const note of notes) {
            note.inscriptionId = inscription.id;
            // Une dispense n'appartient à aucun Terme de l'année en cours
            // (voir dispenses.service.ts) — la mélanger à "Terme non
            // précisé" la ferait passer pour une donnée incomplète,
            // plutôt qu'une équivalence délibérément accordée. Sa propre
            // section, avec niveau et semestre, la distingue clairement.
            if (note.dispense) {
              dispensesTrouvees.push(note);
              continue;
            }
            const libelle = note.terme ? LIBELLE_TERME[note.terme] : 'Terme non précisé';
            const contexte = `${libelle} (${inscription.anneeUniversitaire.libelle})`;
            if (!groupesParSemestre.has(contexte)) {
              groupesParSemestre.set(contexte, { cle: contexte, contexte, notes: [] });
            }
            groupesParSemestre.get(contexte)!.notes.push(note);
          }
        }

        setNotesParSemestre(Array.from(groupesParSemestre.values()));
        setDispenses(dispensesTrouvees);

        // Une fois par inscription — le calcul se limite maintenant à
        // l'année universitaire de CHAQUE inscription précise, jamais
        // mélangé entre deux années différentes du même parcours.
        const etatsAnnee = await Promise.all(
          donnees.inscriptions.map(async (inscription) => ({
            inscriptionId: inscription.id,
            anneeLibelle: inscription.anneeUniversitaire.libelle,
            etat: await calculerEtatAnnee(inscription.id),
          }))
        );
        setEtatsAnneeParInscription(etatsAnnee);
      })
      .catch(() => setErreur('Impossible de charger la fiche étudiant.'))
      .finally(() => setEnChargement(false));
  }

  useEffect(() => {
    chargerFiche();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function gererModifie() {
    setPanneauModificationOuvert(false);
    chargerFiche();
  }

  function gererChangementClasse() {
    setPanneauClasseOuvert(false);
    chargerFiche();
  }

  function gererAffectation() {
    setPanneauAffectationOuvert(false);
    chargerFiche();
  }

  async function gererSuppression() {
    if (!etudiant) return;

    if (!confirmationSuppression) {
      setConfirmationSuppression(true);
      return;
    }

    setEnCoursSuppression(true);
    setErreurSuppression(null);
    try {
      await supprimerEtudiant(etudiant.id);
      navigate('/etudiants');
    } catch (erreurSuppr: unknown) {
      const message =
        (erreurSuppr as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Impossible de supprimer cet étudiant.';
      setErreurSuppression(message);
      setConfirmationSuppression(false);
    } finally {
      setEnCoursSuppression(false);
    }
  }

  async function gererBlocage() {
    if (!etudiant) return;
    setEnCoursBlocage(true);
    setErreurBlocage(null);
    try {
      const misAJour =
        etudiant.statut === 'BLOQUE' ? await debloquerEtudiant(etudiant.id) : await bloquerEtudiant(etudiant.id);
      setEtudiant({ ...etudiant, statut: misAJour.statut });
    } catch {
      setErreurBlocage(
        etudiant.statut === 'BLOQUE' ? 'Impossible de débloquer cet étudiant.' : 'Impossible de bloquer cet étudiant.'
      );
    } finally {
      setEnCoursBlocage(false);
    }
  }

  if (enChargement) {
    return (
      <div>
        <EnTete />
        <p className="ligne-vide">Chargement...</p>
      </div>
    );
  }

  if (erreur || !etudiant) {
    return (
      <div>
        <EnTete />
        <p className="ligne-vide" style={{ color: 'var(--couleur-erreur)' }}>
          {erreur ?? 'Étudiant introuvable.'}
        </p>
      </div>
    );
  }

  const inscriptionActive = etudiant.inscriptions.find((i) => i.statutInscription === 'ACTIVE');

  // Supprimable si AUCUNE inscription ne porte de données réelles (notes,
  // composantes, absences, choix électifs, affectations de cours réelles
  // du parcours flexible) — une inscription vide (jamais utilisée)
  // n'empêche pas la suppression, contrairement à un vrai historique
  // académique. Cohérent avec la règle appliquée côté serveur.
  const etudiantEstSupprimable = etudiant.inscriptions.every(
    (i) =>
      i._count.notes === 0 &&
      i._count.composantesEvaluation === 0 &&
      i._count.absences === 0 &&
      i._count.choixElectifs === 0 &&
      i._count.affectationsCours === 0
  );

  const colonnesComposantes = determinerColonnesComposantes(notesParSemestre);

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        {etudiant.statut === 'BLOQUE' && (
          <div className="bandeau-bloque" role="alert">
            Cet étudiant est bloqué. Il n'apparaît plus dans les recherches, la saisie, les bulletins, ni le
            rattrapage. Ses données restent intactes et il reste visible dans la liste de sa classe.
          </div>
        )}

        <div className="entete-fiche" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{etudiant.nom}</h1>
            <span className="entete-fiche-matricule">{etudiant.matricule}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="bouton-secondaire" onClick={() => setPanneauModificationOuvert(true)}>
                Modifier la fiche
              </button>
              {inscriptionActive ? (
                <button className="bouton-secondaire" onClick={() => setPanneauClasseOuvert(true)}>
                  Changer de classe
                </button>
              ) : (
                <button className="bouton-principal" onClick={() => setPanneauAffectationOuvert(true)}>
                  Affecter à une classe
                </button>
              )}
              <button className="bouton-secondaire" onClick={gererBlocage} disabled={enCoursBlocage}>
                {enCoursBlocage
                  ? 'En cours...'
                  : etudiant.statut === 'BLOQUE'
                  ? 'Débloquer'
                  : 'Bloquer'}
              </button>
              {etudiantEstSupprimable && (
                <button className="bouton-secondaire" onClick={gererSuppression} disabled={enCoursSuppression}>
                  {enCoursSuppression
                    ? 'Suppression...'
                    : confirmationSuppression
                    ? 'Confirmer la suppression ?'
                    : 'Supprimer'}
                </button>
              )}
            </div>
            {erreurSuppression && (
              <p style={{ color: 'var(--couleur-erreur)', fontSize: 13, margin: 0 }}>{erreurSuppression}</p>
            )}
            {erreurBlocage && (
              <p style={{ color: 'var(--couleur-erreur)', fontSize: 13, margin: 0 }}>{erreurBlocage}</p>
            )}
          </div>
        </div>

        {etatsAnneeParInscription.map(({ inscriptionId, anneeLibelle, etat }) => (
          <div className="section-fiche" key={inscriptionId}>
            <h2>État de l'année {anneeLibelle}</h2>
            <div className="ligne-badges" style={{ marginBottom: 12 }}>
              {etat.termes.map((t) => (
                <span
                  key={t.terme}
                  className={`badge-etat ${!t.touche ? '' : t.termine ? 'badge-valide' : 'badge-en-attente'}`}
                >
                  {LIBELLE_TERME[t.terme]} : {!t.touche ? 'non touché' : t.termine ? 'terminé' : 'en cours'}
                </span>
              ))}
            </div>
            <p>
              Année {etat.anneeFermee ? 'fermée' : etat.anneeTerminee ? 'terminée' : 'non terminée'}.
              {etat.matieresNonValidees.length > 0 && (
                <>
                  {' '}
                  Matières non validées : {etat.matieresNonValidees.map((m) => `${m.titre} (${m.code})`).join(', ')}.
                </>
              )}
            </p>
          </div>
        ))}

        <div className="section-fiche">
          <h2>Historique académique</h2>
          <table className="tableau-liste">
            <thead>
              <tr>
                <th>Année universitaire</th>
                <th>Parcours</th>
                <th>Niveau</th>
                <th>Classe</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {etudiant.inscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="ligne-vide">Aucune inscription.</td>
                </tr>
              ) : (
                etudiant.inscriptions.map((inscription) => (
                  <tr key={inscription.id}>
                    <td>{inscription.anneeUniversitaire.libelle}</td>
                    <td>{inscription.parcours.nom}</td>
                    <td>{inscription.niveau.libelle}</td>
                    <td>{inscription.classe.nom}</td>
                    <td>{inscription.statutInscription === 'ACTIVE' ? 'Active' : 'Clôturée'}</td>
                    <td>
                      {inscription.niveau.ordre !== 1 && (
                        <Link to={`/dispenses/${inscription.id}`} className="bouton-secondaire">
                          Dispenses
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="section-fiche">
          <h2>Notes</h2>
          {notesParSemestre.length === 0 ? (
            <p className="ligne-vide">Aucune note enregistrée.</p>
          ) : (
            notesParSemestre.map((groupe) => (
              <div key={groupe.cle} style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--couleur-gris-texte)' }}>
                  {groupe.contexte}
                </p>
                <table className="tableau-liste">
                  <thead>
                    <tr>
                      <th>UE</th>
                      <th>Cours</th>
                      {colonnesComposantes.map((type) => (
                        <th key={type}>{LABELS_COMPOSANTES[type]}</th>
                      ))}
                      <th>Moyenne</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupe.notes.map((note) => (
                      <tr key={note.coursId}>
                        <td>{note.ueCode}</td>
                        <td>
                          {note.coursTitre} ({note.coursCode})
                          {note.typeSuivi === 'ANTICIPE' && (
                            <span className="badge-etat badge-en-attente" style={{ marginLeft: 8 }}>Anticipé</span>
                          )}
                          {note.typeSuivi === 'EN_RETARD' && (
                            <span className="badge-etat badge-echoue" style={{ marginLeft: 8 }}>En retard</span>
                          )}
                        </td>
                        {colonnesComposantes.map((type) => (
                          <td key={type}>{note.composantes[type] ?? '—'}</td>
                        ))}
                        <td>{note.moyenne ?? '—'}</td>
                        <td>
                          {note.statutValidation ? (
                            <span className={`badge-statut ${CLASSES_STATUT_VALIDATION[note.statutValidation]}`}>
                              {LABELS_STATUT_VALIDATION[note.statutValidation]}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--couleur-gris-texte)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        {dispenses.length > 0 && (() => {
          // Groupé par niveau — des dispenses peuvent toucher plusieurs
          // niveaux à la fois (voir dispenses.service.ts), chacun avec son
          // propre bulletin individuel téléchargeable séparément.
          const parNiveau = new Map<string, typeof dispenses>();
          for (const note of dispenses) {
            if (!parNiveau.has(note.niveauId)) parNiveau.set(note.niveauId, []);
            parNiveau.get(note.niveauId)!.push(note);
          }

          return Array.from(parNiveau.entries()).map(([niveauId, notesDuNiveau]) => (
            <div key={niveauId} className="section-fiche">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Dispensé(s), {notesDuNiveau[0].niveau}</h2>
                <button
                  className="bouton-secondaire"
                  onClick={() =>
                    telechargerBulletinIndividuelPdf(
                      notesDuNiveau[0].inscriptionId,
                      niveauId,
                      etudiant?.matricule ?? '',
                      notesDuNiveau[0].niveau
                    )
                  }
                >
                  Télécharger le bulletin individuel (PDF)
                </button>
              </div>
              <table className="tableau-liste">
                <thead>
                  <tr>
                    <th>Semestre</th>
                    <th>UE</th>
                    <th>Cours</th>
                    <th>Université d'origine</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {notesDuNiveau.map((note) => (
                    <tr key={note.coursId}>
                      <td>{note.semestre}</td>
                      <td>{note.ueCode}</td>
                      <td>{note.coursTitre} ({note.coursCode})</td>
                      <td>{note.universiteOrigine}</td>
                      <td>
                        {note.statutValidation ? (
                          <span className={`badge-statut ${CLASSES_STATUT_VALIDATION[note.statutValidation]}`}>
                            {LABELS_STATUT_VALIDATION[note.statutValidation]}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--couleur-gris-texte)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ));
        })()}

        <div className="section-fiche">
          <h2>Historique des absences</h2>
          <table className="tableau-liste">
            <thead>
              <tr>
                <th>Date</th>
                <th>Cours</th>
                <th>Semestre</th>
              </tr>
            </thead>
            <tbody>
              {absences.length === 0 ? (
                <tr>
                  <td colSpan={3} className="ligne-vide">Aucune absence enregistrée.</td>
                </tr>
              ) : (
                absences.map((absence) => (
                  <tr key={absence.id}>
                    <td>{new Date(absence.dateSeance).toLocaleDateString('fr-FR')}</td>
                    <td>{absence.cours.titre} ({absence.cours.code})</td>
                    <td>{absence.contexte}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {panneauModificationOuvert && (
        <PanneauModificationEtudiant
          etudiant={etudiant}
          onModifie={gererModifie}
          onAnnuler={() => setPanneauModificationOuvert(false)}
        />
      )}

      {panneauClasseOuvert && inscriptionActive && (
        <PanneauChangementClasse
          inscriptionId={inscriptionActive.id}
          classeActuelleNom={inscriptionActive.classe.nom}
          onChange={gererChangementClasse}
          onAnnuler={() => setPanneauClasseOuvert(false)}
        />
      )}

      {panneauAffectationOuvert && (
        <PanneauAffectationClasse
          etudiantId={etudiant.id}
          onAffecte={gererAffectation}
          onAnnuler={() => setPanneauAffectationOuvert(false)}
        />
      )}
    </div>
  );
}
