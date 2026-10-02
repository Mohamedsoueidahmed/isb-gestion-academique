import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { creerEtudiant, trouverEtudiantParMatricule, creerInscription } from '../../services/etudiants.service';
import { listerAnneesUniversitaires, listerParcours } from '../../services/referentiel.service';
import { listerClasses } from '../../services/classes.service';
import type { AnneeUniversitaire, Parcours, Classe } from '../../types/classes.types';
import type { Etudiant } from '../../types/etudiants.types';
import '../classes/PanneauCreationClasse.css';
import './PanneauInscriptionEtudiant.css';

interface Props {
  onTermine: () => void;
  onAnnuler: () => void;
}

function extraireMessageErreur(erreur: unknown, messageParDefaut: string): string {
  return (
    (erreur as { response?: { data?: { message?: string } } })?.response?.data?.message ?? messageParDefaut
  );
}

export default function PanneauInscriptionEtudiant({ onTermine, onAnnuler }: Props) {
  const [etape, setEtape] = useState<1 | 2>(1);
  const [etudiantCree, setEtudiantCree] = useState<Etudiant | null>(null);
  const [etudiantEtaitExistant, setEtudiantEtaitExistant] = useState(false);

  // --- Étape 1 : fiche étudiant ---
  const [matricule, setMatricule] = useState('');
  const [nom, setNom] = useState('');
  const [inn, setInn] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [typeBac, setTypeBac] = useState('');
  const [numeroBac, setNumeroBac] = useState('');
  const [enCoursEtape1, setEnCoursEtape1] = useState(false);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [erreurEtape1, setErreurEtape1] = useState<string | null>(null);

  // --- Étape 2 : affectation académique ---
  const [annees, setAnnees] = useState<AnneeUniversitaire[]>([]);
  const [parcoursListe, setParcoursListe] = useState<Parcours[]>([]);
  const [classesDisponibles, setClassesDisponibles] = useState<Classe[]>([]);
  const [anneeId, setAnneeId] = useState('');
  const [parcoursId, setParcoursId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [chargementClasses, setChargementClasses] = useState(false);
  const [enCoursEtape2, setEnCoursEtape2] = useState(false);
  const [erreurEtape2, setErreurEtape2] = useState<string | null>(null);

  useEffect(() => {
    if (etape === 2) {
      listerAnneesUniversitaires().then(setAnnees);
      listerParcours().then(setParcoursListe);
    }
  }, [etape]);

  // Une fois année et parcours choisis, on filtre directement les classes
  // existantes — pas besoin de refaire la cascade niveau/semestre, une
  // classe encode déjà cette information.
  useEffect(() => {
    setClasseId('');

    if (!anneeId || !parcoursId) {
      setClassesDisponibles([]);
      return;
    }

    setChargementClasses(true);
    listerClasses({ anneeUniversitaireId: anneeId, parcoursId })
      .then(setClassesDisponibles)
      .finally(() => setChargementClasses(false));
  }, [anneeId, parcoursId]);

  /**
   * Dès que l'admin quitte le champ matricule, on cherche immédiatement
   * si un étudiant le porte déjà — sans attendre la soumission, et sans
   * exiger le nom au préalable (il ne sert qu'à créer une NOUVELLE
   * fiche). Trouvé : on remplit visuellement le nom, verrouillé, pour
   * montrer clairement que c'est la fiche existante qui continue, jamais
   * une nouvelle création.
   */
  async function gererBlurMatricule() {
    if (!matricule.trim()) return;
    setRechercheEnCours(true);
    try {
      const etudiantExistant = await trouverEtudiantParMatricule(matricule.trim());
      if (etudiantExistant) {
        setNom(etudiantExistant.nom);
        setInn(etudiantExistant.inn ?? '');
        setDateNaissance(etudiantExistant.dateNaissance ? etudiantExistant.dateNaissance.slice(0, 10) : '');
        setTypeBac(etudiantExistant.typeBac ?? '');
        setNumeroBac(etudiantExistant.numeroBac ?? '');
        setEtudiantCree(etudiantExistant);
        setEtudiantEtaitExistant(true);
      }
    } catch {
      // Une recherche échouée ici n'est pas bloquante — la vraie
      // tentative, avec message d'erreur, aura lieu à la soumission.
    } finally {
      setRechercheEnCours(false);
    }
  }

  async function gererSoumissionEtape1(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreurEtape1(null);

    if (!matricule.trim()) {
      setErreurEtape1('Le matricule est requis.');
      return;
    }

    setEnCoursEtape1(true);
    try {
      // Si la recherche automatique (au blur du matricule, ci-dessus) a
      // déjà retrouvé un étudiant existant, on continue directement avec
      // lui — inutile de revalider ou de refaire la recherche.
      if (etudiantEtaitExistant && etudiantCree) {
        setEtape(2);
        return;
      }

      // Le matricule est la clé de continuité de tout le parcours d'un
      // étudiant — s'il existe déjà, c'est le MÊME étudiant qui continue
      // (nouvelle année, nouveau niveau), jamais une nouvelle fiche à
      // créer. On ne tente la création que si aucun étudiant ne porte
      // déjà ce matricule.
      const etudiantExistant = await trouverEtudiantParMatricule(matricule.trim());
      if (etudiantExistant) {
        setNom(etudiantExistant.nom);
        setInn(etudiantExistant.inn ?? '');
        setDateNaissance(etudiantExistant.dateNaissance ? etudiantExistant.dateNaissance.slice(0, 10) : '');
        setTypeBac(etudiantExistant.typeBac ?? '');
        setNumeroBac(etudiantExistant.numeroBac ?? '');
        setEtudiantCree(etudiantExistant);
        setEtudiantEtaitExistant(true);
        setEtape(2);
        return;
      }

      if (!nom.trim()) {
        setErreurEtape1('Le nom est requis pour créer une nouvelle fiche.');
        return;
      }

      const etudiant = await creerEtudiant({
        matricule: matricule.trim(),
        nom: nom.trim(),
        inn: inn.trim() || undefined,
        dateNaissance: dateNaissance || undefined,
        typeBac: typeBac.trim() || undefined,
        numeroBac: numeroBac.trim() || undefined,
      });
      setEtudiantCree(etudiant);
      setEtudiantEtaitExistant(false);
      setEtape(2);
    } catch (erreur) {
      setErreurEtape1(extraireMessageErreur(erreur, "Une erreur est survenue lors de la création de la fiche."));
    } finally {
      setEnCoursEtape1(false);
    }
  }

  async function gererSoumissionEtape2(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreurEtape2(null);

    if (!etudiantCree || !anneeId || !parcoursId || !classeId) {
      setErreurEtape2('Tous les champs sont requis.');
      return;
    }

    const classeChoisie = classesDisponibles.find((c) => c.id === classeId);
    if (!classeChoisie) {
      setErreurEtape2('Classe introuvable.');
      return;
    }

    setEnCoursEtape2(true);
    try {
      await creerInscription(etudiantCree.id, classeId);
      onTermine();
    } catch (erreur) {
      setErreurEtape2(extraireMessageErreur(erreur, "Une erreur est survenue lors de l'inscription."));
    } finally {
      setEnCoursEtape2(false);
    }
  }

  return (
    <div className="superposition-panneau" onClick={onAnnuler}>
      <div className="panneau-creation" onClick={(e) => e.stopPropagation()}>
        <h2>Inscrire un étudiant</h2>
        <p className="panneau-sous-titre">
          {etape === 1 ? 'Créez d\'abord la fiche de l\'étudiant.' : "Affectez maintenant l'étudiant à sa classe."}
        </p>

        <div className="etapes">
          <div className="etape-puce active" />
          <div className={`etape-puce ${etape === 2 ? 'active' : ''}`} />
        </div>

        {etape === 1 && (
          <form onSubmit={gererSoumissionEtape1}>
            <div className="champ">
              <label htmlFor="matricule">Matricule</label>
              <input
                id="matricule"
                type="text"
                placeholder="Ex. 2026-003"
                value={matricule}
                onChange={(e) => {
                  setMatricule(e.target.value);
                  if (etudiantEtaitExistant) {
                    setEtudiantEtaitExistant(false);
                    setEtudiantCree(null);
                    setNom('');
                    setInn('');
                    setDateNaissance('');
                    setTypeBac('');
                    setNumeroBac('');
                  }
                }}
                onBlur={gererBlurMatricule}
                disabled={enCoursEtape1}
                autoFocus
              />
              {rechercheEnCours && <p className="panneau-sous-titre" style={{ marginTop: 6 }}>Recherche...</p>}
              {etudiantEtaitExistant && !rechercheEnCours && (
                <p className="panneau-sous-titre" style={{ marginTop: 6, color: 'var(--couleur-vert-fonce)' }}>
                  Étudiant existant trouvé. Son parcours continue.
                </p>
              )}
            </div>
            <div className="champ">
              <label htmlFor="nom">Nom</label>
              <input
                id="nom"
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                disabled={enCoursEtape1 || etudiantEtaitExistant}
              />
            </div>

            <div className="rangee-deux-champs">
              <div className="champ">
                <label htmlFor="inn">INN</label>
                <input
                  id="inn"
                  type="text"
                  value={inn}
                  onChange={(e) => setInn(e.target.value)}
                  disabled={enCoursEtape1 || etudiantEtaitExistant}
                />
              </div>
              <div className="champ">
                <label htmlFor="dateNaissance">Date de naissance</label>
                <input
                  id="dateNaissance"
                  type="date"
                  value={dateNaissance}
                  onChange={(e) => setDateNaissance(e.target.value)}
                  disabled={enCoursEtape1 || etudiantEtaitExistant}
                />
              </div>
            </div>

            <div className="rangee-deux-champs">
              <div className="champ">
                <label htmlFor="typeBac">Type de Bac</label>
                <input
                  id="typeBac"
                  type="text"
                  value={typeBac}
                  onChange={(e) => setTypeBac(e.target.value)}
                  disabled={enCoursEtape1 || etudiantEtaitExistant}
                />
              </div>
              <div className="champ">
                <label htmlFor="numeroBac">Numéro de Bac</label>
                <input
                  id="numeroBac"
                  type="text"
                  value={numeroBac}
                  onChange={(e) => setNumeroBac(e.target.value)}
                  disabled={enCoursEtape1 || etudiantEtaitExistant}
                />
              </div>
            </div>

            {erreurEtape1 && <p className="message-erreur-panneau" role="alert">{erreurEtape1}</p>}

            <div className="boutons-panneau">
              <button type="submit" className="bouton-principal" disabled={enCoursEtape1}>
                {enCoursEtape1 ? 'Création en cours...' : 'Continuer'}
              </button>
              <button type="button" className="bouton-secondaire" onClick={onAnnuler} disabled={enCoursEtape1}>
                Annuler
              </button>
            </div>
          </form>
        )}

        {etape === 2 && etudiantCree && (
          <form onSubmit={gererSoumissionEtape2}>
            <div className="confirmation-etudiant">
              {etudiantEtaitExistant ? (
                <>
                  Étudiant existant retrouvé : <strong>{etudiantCree.nom}</strong>, matricule{' '}
                  <strong>{etudiantCree.matricule}</strong>. Son parcours continue, rien n'est perdu.
                </>
              ) : (
                <>
                  Fiche créée pour <strong>{etudiantCree.nom}</strong>, matricule{' '}
                  <strong>{etudiantCree.matricule}</strong>
                </>
              )}
            </div>

            <div className="champ">
              <label htmlFor="annee">Année universitaire</label>
              <select id="annee" value={anneeId} onChange={(e) => setAnneeId(e.target.value)} disabled={enCoursEtape2}>
                <option value="">Sélectionner...</option>
                {annees.map((a) => (
                  <option key={a.id} value={a.id}>{a.libelle}</option>
                ))}
              </select>
            </div>

            <div className="champ">
              <label htmlFor="parcours">Parcours</label>
              <select
                id="parcours"
                value={parcoursId}
                onChange={(e) => setParcoursId(e.target.value)}
                disabled={enCoursEtape2}
              >
                <option value="">Sélectionner...</option>
                {[...parcoursListe]
                  .sort((a, b) => {
                    const cycleA = a.formation.cycle ?? '';
                    const cycleB = b.formation.cycle ?? '';
                    return cycleA !== cycleB ? cycleA.localeCompare(cycleB) : a.nom.localeCompare(b.nom);
                  })
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      ({p.formation.cycle === 'MASTER' ? 'M' : 'L'}) {p.nom}
                    </option>
                  ))}
              </select>
            </div>

            <div className="champ">
              <label htmlFor="classe">Classe</label>
              <select
                id="classe"
                value={classeId}
                onChange={(e) => setClasseId(e.target.value)}
                disabled={!anneeId || !parcoursId || chargementClasses || enCoursEtape2}
              >
                <option value="">
                  {!anneeId || !parcoursId
                    ? "Choisir l'année et le parcours d'abord"
                    : chargementClasses
                    ? 'Chargement...'
                    : classesDisponibles.length === 0
                    ? 'Aucune classe disponible'
                    : 'Sélectionner...'}
                </option>
                {classesDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} ({c._count?.inscriptions ?? 0} étudiant{(c._count?.inscriptions ?? 0) !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </div>

            {erreurEtape2 && <p className="message-erreur-panneau" role="alert">{erreurEtape2}</p>}

            <div className="boutons-panneau">
              <button type="submit" className="bouton-principal" disabled={enCoursEtape2}>
                {enCoursEtape2 ? 'Inscription en cours...' : "Confirmer l'inscription"}
              </button>
              <button type="button" className="bouton-secondaire" onClick={onAnnuler} disabled={enCoursEtape2}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
