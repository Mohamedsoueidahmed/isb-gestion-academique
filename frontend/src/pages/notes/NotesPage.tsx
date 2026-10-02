import { useEffect, useState } from 'react';
import EnTete from '../../components/EnTete';
import CelluleComposante from './CelluleComposante';
import { listerClasses } from '../../services/classes.service';
import { listerCoursAffectesParTerme } from '../../services/lots.service';
import { obtenirNotesCoursPourClasse, obtenirComposantesInscriptionCours, telechargerExportNotesPdf } from '../../services/notes.service';
import { useAnneeUniversitaire } from '../../contexts/AnneeUniversitaireContext';
import type { Classe } from '../../types/classes.types';
import type { GroupeCoursTerme } from '../../types/lots.types';
import type { EtudiantAvecComposantes, CycleFormation } from '../../types/notes.types';
import {
  LABELS_STATUT_VALIDATION,
  CLASSES_STATUT_VALIDATION,
  LABELS_COMPOSANTES,
  COLONNES_PAR_CYCLE,
} from '../../constants/notesConstants';
import '../../styles/listes.css';
import './NotesPage.css';

const LIBELLE_TERME: Record<string, string> = { AUTOMNE: 'Automne', PRINTEMPS: 'Printemps', ETE: 'Été' };

export default function NotesPage() {
  const { anneeSelectionneeId } = useAnneeUniversitaire();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [groupesTerme, setGroupesTerme] = useState<GroupeCoursTerme[]>([]);
  const [termeActif, setTermeActif] = useState<string | null>(null);
  const [cycle, setCycle] = useState<CycleFormation | null>(null);
  const [etudiants, setEtudiants] = useState<EtudiantAvecComposantes[]>([]);

  const [classeId, setClasseId] = useState('');
  const [coursId, setCoursId] = useState('');

  const [chargementCours, setChargementCours] = useState(false);
  const [chargementLignes, setChargementLignes] = useState(false);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setClasseId('');
    if (!anneeSelectionneeId) return;
    listerClasses({ anneeUniversitaireId: anneeSelectionneeId }).then(setClasses);
  }, [anneeSelectionneeId]);

  useEffect(() => {
    setCoursId('');
    setTermeActif(null);
    setEtudiants([]);

    if (!classeId) {
      setGroupesTerme([]);
      return;
    }

    setChargementCours(true);
    listerCoursAffectesParTerme(classeId)
      .then((groupes) => {
        setGroupesTerme(groupes);
        setTermeActif(groupes[0]?.terme ?? null);
      })
      .finally(() => setChargementCours(false));
  }, [classeId]);

  useEffect(() => {
    if (!classeId || !coursId) {
      setEtudiants([]);
      return;
    }

    setChargementLignes(true);
    setErreur(null);
    obtenirNotesCoursPourClasse(classeId, coursId)
      .then((donnees) => {
        setCycle(donnees.cycle);
        setEtudiants(donnees.etudiants);
      })
      .catch(() => setErreur('Impossible de charger les notes de ce cours.'))
      .finally(() => setChargementLignes(false));
  }, [classeId, coursId]);

  function gererChangementTerme(terme: string | null) {
    setTermeActif(terme);
    setCoursId('');
    setEtudiants([]);
  }

  async function gererTelechargementPdf() {
    if (!classeId) return;
    setTelechargementEnCours(true);
    setErreur(null);
    try {
      await telechargerExportNotesPdf(classeId, termeActif);
    } catch {
      setErreur("Impossible de télécharger le PDF de ce Terme.");
    } finally {
      setTelechargementEnCours(false);
    }
  }

  /**
   * Recharge uniquement la ligne de cet étudiant depuis le serveur après
   * une sauvegarde — la moyenne, le statut et la visibilité de la Session 2
   * peuvent tous changer suite à une seule composante modifiée, donc on ne
   * les recalcule pas localement (source de vérité = backend uniquement).
   */
  async function rafraichirLigne(inscriptionId: string) {
    const donnees = await obtenirComposantesInscriptionCours(inscriptionId, coursId);
    setEtudiants((precedent) =>
      precedent.map((e) => (e.inscriptionId === inscriptionId ? { ...e, ...donnees } : e))
    );
  }

  const colonnesComposantes = cycle ? COLONNES_PAR_CYCLE[cycle] : [];
  // La colonne Session 2 apparaît dès qu'au moins un étudiant en a besoin —
  // un tableau ne peut pas avoir des colonnes différentes ligne par ligne.
  const colonneSession2Visible = etudiants.some((e) => e.session2Visible);

  const nombreValidees = etudiants.filter((e) => e.statutValidation === 'VALIDEE').length;

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <h1>Saisie des notes</h1>

        <div className="selecteurs-notes">
          <div className="champ-selecteur">
            <label htmlFor="classe">Classe</label>
            <select id="classe" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">Sélectionner une classe...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
        </div>

        {classeId && !chargementCours && groupesTerme.length === 0 && (
          <p className="ligne-vide">Aucun cours réellement affecté dans cette classe pour l'instant.</p>
        )}

        {groupesTerme.length > 0 && (
          <div className="onglets-terme">
            {groupesTerme.map((groupe) => (
              <button
                key={groupe.terme ?? 'sans-terme'}
                className={`onglet-terme ${termeActif === groupe.terme ? 'onglet-terme-actif' : ''}`}
                onClick={() => gererChangementTerme(groupe.terme)}
              >
                {LIBELLE_TERME[groupe.terme ?? ''] ?? 'Sans terme'}
              </button>
            ))}
            <button
              className="bouton-secondaire bouton-telechargement-terme"
              onClick={gererTelechargementPdf}
              disabled={telechargementEnCours}
            >
              {telechargementEnCours ? 'Téléchargement...' : 'Télécharger ce Terme (PDF)'}
            </button>
          </div>
        )}

        {groupesTerme.length > 0 && (
          <div className="selecteurs-notes">
            <div className="champ-selecteur">
              <label htmlFor="cours">Cours</label>
              <select
                id="cours"
                value={coursId}
                onChange={(e) => setCoursId(e.target.value)}
                disabled={chargementCours}
              >
                <option value="">{chargementCours ? 'Chargement...' : 'Sélectionner un cours...'}</option>
                {(groupesTerme.find((g) => g.terme === termeActif)?.cours ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.titre} ({c.code})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {chargementLignes && <p className="ligne-vide">Chargement...</p>}
        {erreur && <p className="ligne-vide" style={{ color: 'var(--couleur-erreur)' }}>{erreur}</p>}

        {!chargementLignes && !erreur && classeId && coursId && cycle && (
          <>
            <p className="entete-cycle">Formation de {cycle === 'LICENCE' ? 'Licence' : 'Master'}</p>

            <div className="bandeau-progression">
              <span>{etudiants.length} étudiant{etudiants.length !== 1 ? 's' : ''}</span>
              <span className={nombreValidees === etudiants.length ? 'compteur-complet' : 'compteur-manquantes'}>
                {nombreValidees} / {etudiants.length} matière{etudiants.length !== 1 ? 's' : ''} validée{nombreValidees !== 1 ? 's' : ''}
              </span>
            </div>

            <table className="tableau-saisie-notes">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Étudiant</th>
                  {colonnesComposantes.map((type) => (
                    <th key={type}>{LABELS_COMPOSANTES[type]}</th>
                  ))}
                  {colonneSession2Visible && <th>{LABELS_COMPOSANTES.EXAMEN_SESSION_2}</th>}
                  <th>Moyenne</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {etudiants.length === 0 ? (
                  <tr>
                    <td colSpan={colonnesComposantes.length + (colonneSession2Visible ? 5 : 4)} className="ligne-vide">
                      Aucun étudiant inscrit dans cette classe.
                    </td>
                  </tr>
                ) : (
                  etudiants.map((etudiant) => (
                    <tr key={etudiant.inscriptionId}>
                      <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--couleur-gris-texte)' }}>
                        {etudiant.etudiant.matricule}
                      </td>
                      <td>{etudiant.etudiant.nom}</td>

                      {colonnesComposantes.map((type) => (
                        <td key={type}>
                          <CelluleComposante
                            inscriptionId={etudiant.inscriptionId}
                            coursId={coursId}
                            type={type}
                            valeurActuelle={etudiant.composantes[type] ?? null}
                            onSauvegardee={() => rafraichirLigne(etudiant.inscriptionId)}
                          />
                        </td>
                      ))}

                      {colonneSession2Visible && (
                        <td>
                          {etudiant.session2Visible ? (
                            <CelluleComposante
                              inscriptionId={etudiant.inscriptionId}
                              coursId={coursId}
                              type="EXAMEN_SESSION_2"
                              valeurActuelle={etudiant.composantes.EXAMEN_SESSION_2 ?? null}
                              onSauvegardee={() => rafraichirLigne(etudiant.inscriptionId)}
                            />
                          ) : (
                            <span className="cellule-session2-inactive">—</span>
                          )}
                        </td>
                      )}

                      <td className="cellule-moyenne">{etudiant.moyenne ?? '—'}</td>
                      <td>
                        {etudiant.statutValidation ? (
                          <span className={`badge-statut ${CLASSES_STATUT_VALIDATION[etudiant.statutValidation]}`}>
                            {LABELS_STATUT_VALIDATION[etudiant.statutValidation]}
                          </span>
                        ) : (
                          <span className="cellule-session2-inactive">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
