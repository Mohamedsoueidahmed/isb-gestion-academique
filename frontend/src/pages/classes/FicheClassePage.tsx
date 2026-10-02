import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import EnTete from '../../components/EnTete';
import PanneauModificationClasse from './PanneauModificationClasse';
import { obtenirClasseParId, supprimerClasse, basculerSemestreActif, telechargerListeEtudiantsPdf } from '../../services/classes.service';
import { listerSemestresParNiveau } from '../../services/referentiel.service';
import { listerCreneauxElectifsPourClasse } from '../../services/electifs.service';
import { bloquerEtudiant, debloquerEtudiant } from '../../services/etudiants.service';
import type { ClasseDetail } from '../../types/classes.types';
import '../../styles/listes.css';
import '../etudiants/FicheEtudiantPage.css';

export default function FicheClassePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [classe, setClasse] = useState<ClasseDetail | null>(null);
  const [autreSemestreLibelle, setAutreSemestreLibelle] = useState<string | null>(null);
  const [aDesCreneauxElectifs, setADesCreneauxElectifs] = useState(false);
  const [enCoursBlocagePour, setEnCoursBlocagePour] = useState<string | null>(null);
  const [erreurBlocageListe, setErreurBlocageListe] = useState<string | null>(null);
  const [enChargement, setEnChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [panneauModificationOuvert, setPanneauModificationOuvert] = useState(false);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [enCoursSuppression, setEnCoursSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);

  const [confirmationBascule, setConfirmationBascule] = useState(false);
  const [enCoursBascule, setEnCoursBascule] = useState(false);
  const [erreurBascule, setErreurBascule] = useState<string | null>(null);

  function charger() {
    if (!id) return;
    setEnChargement(true);
    setErreur(null);
    obtenirClasseParId(id)
      .then(async (classeChargee) => {
        setClasse(classeChargee);
        // Le vrai libellé de "l'autre" semestre du niveau — jamais deviné
        // via une supposition S1/S2, qui ne tient que pour L1 (S3/S4 pour
        // L2, S5/S6 pour L3).
        const semestresDuNiveau = await listerSemestresParNiveau(classeChargee.niveau.id);
        const autre = semestresDuNiveau.find((s) => s.ordre !== classeChargee.semestreActif.ordre);
        setAutreSemestreLibelle(autre?.libelle ?? null);

        // Le lien "Cours électifs" ne s'affiche que si le semestre
        // actuellement actif en a réellement besoin — pas pertinent pour
        // la plupart des classes la plupart du temps.
        const creneaux = await listerCreneauxElectifsPourClasse(id);
        setADesCreneauxElectifs(creneaux.length > 0);
      })
      .catch(() => setErreur('Impossible de charger cette classe.'))
      .finally(() => setEnChargement(false));
  }


  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function gererModifiee() {
    setPanneauModificationOuvert(false);
    charger();
  }

  async function gererSuppression() {
    if (!classe) return;

    if (!confirmationSuppression) {
      setConfirmationSuppression(true);
      return;
    }

    setEnCoursSuppression(true);
    setErreurSuppression(null);
    try {
      await supprimerClasse(classe.id);
      navigate('/classes');
    } catch (erreurSuppr: unknown) {
      const message =
        (erreurSuppr as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Impossible de supprimer cette classe.';
      setErreurSuppression(message);
      setConfirmationSuppression(false);
    } finally {
      setEnCoursSuppression(false);
    }
  }

  async function gererBascule() {
    if (!classe) return;

    if (!confirmationBascule) {
      setConfirmationBascule(true);
      return;
    }

    setEnCoursBascule(true);
    setErreurBascule(null);
    try {
      await basculerSemestreActif(classe.id);
      setConfirmationBascule(false);
      charger();
    } catch (erreurBasc: unknown) {
      const message =
        (erreurBasc as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Impossible de basculer le semestre.';
      setErreurBascule(message);
      setConfirmationBascule(false);
    } finally {
      setEnCoursBascule(false);
    }
  }

  async function gererBlocageEtudiant(etudiantId: string, statutActuel: string) {
    setEnCoursBlocagePour(etudiantId);
    setErreurBlocageListe(null);
    try {
      if (statutActuel === 'BLOQUE') {
        await debloquerEtudiant(etudiantId);
      } else {
        await bloquerEtudiant(etudiantId);
      }
      charger();
    } catch {
      setErreurBlocageListe(
        statutActuel === 'BLOQUE' ? 'Impossible de débloquer cet étudiant.' : 'Impossible de bloquer cet étudiant.'
      );
    } finally {
      setEnCoursBlocagePour(null);
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

  if (erreur || !classe) {
    return (
      <div>
        <EnTete />
        <p className="ligne-vide" style={{ color: 'var(--couleur-erreur)' }}>
          {erreur ?? 'Classe introuvable.'}
        </p>
      </div>
    );
  }

  const inscriptionsActives = classe.inscriptions.filter((i) => i.statutInscription === 'ACTIVE');
  const classeEstVide = inscriptionsActives.length === 0;

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <div className="entete-fiche" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{classe.nom}</h1>
            <div className="metadonnees-fiche">
              <div>
                <span className="metadonnee-label">Parcours</span>
                <span>{classe.parcours.nom}</span>
              </div>
              <div>
                <span className="metadonnee-label">Niveau</span>
                <span>{classe.niveau.libelle}</span>
              </div>
              <div>
                <span className="metadonnee-label">Semestre bulletin</span>
                <span>{classe.semestreActif.libelle}</span>
              </div>
              <div>
                <span className="metadonnee-label">Année universitaire</span>
                <span>{classe.anneeUniversitaire.libelle}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <button className="bouton-secondaire" onClick={() => setPanneauModificationOuvert(true)}>
              Modifier
            </button>
            {aDesCreneauxElectifs && id && (
              <Link to={`/classes/${id}/electifs`} className="bouton-secondaire">
                Cours électifs
              </Link>
            )}
            {id && (
              <Link to={`/classes/${id}/lots`} className="bouton-secondaire">
                Parcours flexible
              </Link>
            )}
            {id && (
              <Link to={`/classes/${id}/etudiants-par-cours`} className="bouton-secondaire">
                Étudiants par cours
              </Link>
            )}
            <button className="bouton-secondaire" onClick={gererBascule} disabled={enCoursBascule} title="Détermine quel semestre les bulletins de cette classe calculent actuellement">
              {enCoursBascule
                ? 'Bascule en cours...'
                : confirmationBascule
                ? `Confirmer : générer les bulletins ${autreSemestreLibelle ?? "de l'autre semestre"} ?`
                : `Générer les bulletins ${autreSemestreLibelle ?? "de l'autre semestre"}`}
            </button>
            {classeEstVide && (
              <button
                className="bouton-secondaire"
                style={{ color: 'var(--couleur-erreur)', borderColor: 'var(--couleur-erreur)' }}
                onClick={gererSuppression}
                disabled={enCoursSuppression}
              >
                {enCoursSuppression
                  ? 'Suppression...'
                  : confirmationSuppression
                  ? 'Confirmer la suppression ?'
                  : 'Supprimer la classe'}
              </button>
            )}
          </div>
        </div>

        {erreurSuppression && (
          <p style={{ color: 'var(--couleur-erreur)', fontSize: 13, marginBottom: 16 }}>{erreurSuppression}</p>
        )}
        {erreurBascule && (
          <p style={{ color: 'var(--couleur-erreur)', fontSize: 13, marginBottom: 16 }}>{erreurBascule}</p>
        )}
        {!classeEstVide && (
          <p style={{ color: 'var(--couleur-gris-texte)', fontSize: 13, marginBottom: 16 }}>
            La suppression n'est possible que si la classe n'a aucun étudiant inscrit.
          </p>
        )}

        <div className="section-fiche">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>
              Étudiants inscrits ({inscriptionsActives.length}
              {classe.effectifMax ? ` / ${classe.effectifMax}` : ''})
            </h2>
            {inscriptionsActives.length > 0 && (
              <button
                className="bouton-secondaire"
                onClick={() => telechargerListeEtudiantsPdf(classe.id, classe.nom)}
              >
                Télécharger la liste (PDF)
              </button>
            )}
          </div>
          <table className="tableau-liste">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Nom</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {inscriptionsActives.length === 0 ? (
                <tr>
                  <td colSpan={4} className="ligne-vide">Aucun étudiant inscrit dans cette classe.</td>
                </tr>
              ) : (
                inscriptionsActives.map((inscription) => (
                  <tr
                    className="ligne-cliquable"
                    key={inscription.id}
                    onClick={() => navigate(`/etudiants/${inscription.etudiant.id}`)}
                  >
                    <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--couleur-gris-texte)' }}>
                      {inscription.etudiant.matricule}
                    </td>
                    <td>{inscription.etudiant.nom}</td>
                    <td>
                      {inscription.etudiant.statut === 'BLOQUE' && (
                        <span className="badge-bloque">Bloqué</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="bouton-secondaire"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => gererBlocageEtudiant(inscription.etudiant.id, inscription.etudiant.statut)}
                        disabled={enCoursBlocagePour === inscription.etudiant.id}
                      >
                        {enCoursBlocagePour === inscription.etudiant.id
                          ? '...'
                          : inscription.etudiant.statut === 'BLOQUE'
                          ? 'Débloquer'
                          : 'Bloquer'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {erreurBlocageListe && (
            <p style={{ color: 'var(--couleur-erreur)', fontSize: 13, marginTop: 10 }}>{erreurBlocageListe}</p>
          )}
        </div>
      </div>

      {panneauModificationOuvert && (
        <PanneauModificationClasse
          classe={classe}
          onModifiee={gererModifiee}
          onAnnuler={() => setPanneauModificationOuvert(false)}
        />
      )}
    </div>
  );
}
