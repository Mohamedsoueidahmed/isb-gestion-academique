import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { listerAnneesUniversitaires, listerParcours, listerNiveauxParParcours } from '../../services/referentiel.service';
import { creerClasse } from '../../services/classes.service';
import type { AnneeUniversitaire, Parcours, Niveau, Classe } from '../../types/classes.types';
import './PanneauCreationClasse.css';

interface Props {
  onClasseCreee: (classe: Classe) => void;
  onAnnuler: () => void;
}

/**
 * Une classe couvre maintenant tout un niveau (S1 et S2 ensemble) — plus
 * de semestre à choisir ici : la classe démarre automatiquement sur le
 * premier semestre du niveau, la bascule vers le second se faisant plus
 * tard, depuis sa fiche, comme action explicite et séparée.
 */
export default function PanneauCreationClasse({ onClasseCreee, onAnnuler }: Props) {
  const [annees, setAnnees] = useState<AnneeUniversitaire[]>([]);
  const [parcoursListe, setParcoursListe] = useState<Parcours[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);

  const [anneeId, setAnneeId] = useState('');
  const [parcoursId, setParcoursId] = useState('');
  const [niveauId, setNiveauId] = useState('');
  const [nom, setNom] = useState('');
  const [effectifMax, setEffectifMax] = useState('');

  const [chargementNiveaux, setChargementNiveaux] = useState(false);
  const [enCoursCreation, setEnCoursCreation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listerAnneesUniversitaires().then(setAnnees);
    listerParcours().then(setParcoursListe);
  }, []);

  // Cascade : changer de parcours recharge les niveaux et réinitialise
  // tout ce qui en dépendait, pour ne jamais soumettre une combinaison
  // incohérente (ex. un niveau d'un autre parcours resté sélectionné).
  useEffect(() => {
    setNiveauId('');

    if (!parcoursId) {
      setNiveaux([]);
      return;
    }

    setChargementNiveaux(true);
    listerNiveauxParParcours(parcoursId)
      .then(setNiveaux)
      .finally(() => setChargementNiveaux(false));
  }, [parcoursId]);

  async function gererSoumission(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    if (!anneeId || !parcoursId || !niveauId || !nom.trim()) {
      setErreur('Tous les champs marqués sont requis.');
      return;
    }

    setEnCoursCreation(true);
    try {
      const classe = await creerClasse({
        anneeUniversitaireId: anneeId,
        parcoursId,
        niveauId,
        nom: nom.trim(),
        ...(effectifMax ? { effectifMax: Number(effectifMax) } : {}),
      });
      onClasseCreee(classe);
    } catch (erreurCreation: unknown) {
      // On remonte le vrai message du serveur (ex. "Une classe avec ce nom
      // existe déjà...") plutôt qu'un message générique — ces distinctions
      // sont utiles et actionnables pour l'administrateur.
      const message =
        (erreurCreation as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Une erreur est survenue lors de la création.";
      setErreur(message);
    } finally {
      setEnCoursCreation(false);
    }
  }

  return (
    <div className="superposition-panneau" onClick={onAnnuler}>
      <div className="panneau-creation" onClick={(e) => e.stopPropagation()}>
        <h2>Créer une classe</h2>
        <p className="panneau-sous-titre">
          Couvre les deux semestres du niveau choisi. Démarre automatiquement sur le premier des deux.
        </p>

        <form onSubmit={gererSoumission}>
          <div className="champ">
            <label htmlFor="annee">Année universitaire</label>
            <select id="annee" value={anneeId} onChange={(e) => setAnneeId(e.target.value)} disabled={enCoursCreation}>
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
              disabled={enCoursCreation}
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
            <label htmlFor="niveau">Niveau</label>
            <select
              id="niveau"
              value={niveauId}
              onChange={(e) => setNiveauId(e.target.value)}
              disabled={!parcoursId || chargementNiveaux || enCoursCreation}
            >
              <option value="">
                {!parcoursId ? 'Choisir un parcours' : chargementNiveaux ? 'Chargement...' : 'Sélectionner...'}
              </option>
              {niveaux.map((n) => (
                <option key={n.id} value={n.id}>{n.libelle}</option>
              ))}
            </select>
          </div>

          <div className="champ">
            <label htmlFor="nom">Nom de la classe</label>
            <input
              id="nom"
              type="text"
              placeholder="Ex. L1-CCA-A"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              disabled={enCoursCreation}
            />
          </div>

          <div className="champ">
            <label htmlFor="effectif">Effectif maximum (optionnel)</label>
            <input
              id="effectif"
              type="number"
              min={1}
              placeholder="Ex. 40"
              value={effectifMax}
              onChange={(e) => setEffectifMax(e.target.value)}
              disabled={enCoursCreation}
            />
          </div>

          {erreur && <p className="message-erreur-panneau" role="alert">{erreur}</p>}

          <div className="boutons-panneau">
            <button type="submit" className="bouton-principal" disabled={enCoursCreation}>
              {enCoursCreation ? 'Création en cours...' : 'Créer la classe'}
            </button>
            <button type="button" className="bouton-secondaire" onClick={onAnnuler} disabled={enCoursCreation}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
