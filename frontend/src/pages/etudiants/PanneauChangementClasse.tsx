import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { listerAnneesUniversitaires, listerParcours } from '../../services/referentiel.service';
import { listerClasses } from '../../services/classes.service';
import { changerClasseInscription } from '../../services/etudiants.service';
import type { AnneeUniversitaire, Parcours, Classe } from '../../types/classes.types';
import '../classes/PanneauCreationClasse.css';

interface Props {
  inscriptionId: string;
  classeActuelleNom: string;
  onChange: () => void;
  onAnnuler: () => void;
}

export default function PanneauChangementClasse({ inscriptionId, classeActuelleNom, onChange, onAnnuler }: Props) {
  const [annees, setAnnees] = useState<AnneeUniversitaire[]>([]);
  const [parcoursListe, setParcoursListe] = useState<Parcours[]>([]);
  const [classesDisponibles, setClassesDisponibles] = useState<Classe[]>([]);

  const [anneeId, setAnneeId] = useState('');
  const [parcoursId, setParcoursId] = useState('');
  const [classeId, setClasseId] = useState('');

  const [chargementClasses, setChargementClasses] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listerAnneesUniversitaires().then(setAnnees);
    listerParcours().then(setParcoursListe);
  }, []);

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

  async function gererSoumission(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    if (!classeId) {
      setErreur('Sélectionnez une classe.');
      return;
    }

    setEnCours(true);
    try {
      await changerClasseInscription(inscriptionId, classeId);
      onChange();
    } catch (erreurChangement: unknown) {
      const message =
        (erreurChangement as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Une erreur est survenue lors du changement de classe.';
      setErreur(message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="superposition-panneau" onClick={onAnnuler}>
      <div className="panneau-creation" onClick={(e) => e.stopPropagation()}>
        <h2>Changer de classe</h2>
        <p className="panneau-sous-titre">
          Classe actuelle : {classeActuelleNom}. Si des notes ou absences existent déjà,
          l'ancienne inscription sera conservée et une nouvelle sera créée pour préserver l'historique.
        </p>

        <form onSubmit={gererSoumission}>
          <div className="champ">
            <label htmlFor="annee">Année universitaire</label>
            <select id="annee" value={anneeId} onChange={(e) => setAnneeId(e.target.value)} disabled={enCours}>
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
              disabled={enCours}
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
            <label htmlFor="classe">Nouvelle classe</label>
            <select
              id="classe"
              value={classeId}
              onChange={(e) => setClasseId(e.target.value)}
              disabled={!anneeId || !parcoursId || chargementClasses || enCours}
            >
              <option value="">
                {!anneeId || !parcoursId
                  ? "Choisir l'année et le parcours d'abord"
                  : chargementClasses
                  ? 'Chargement...'
                  : 'Sélectionner...'}
              </option>
              {classesDisponibles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} ({c.niveau.libelle})
                </option>
              ))}
            </select>
          </div>

          {erreur && <p className="message-erreur-panneau" role="alert">{erreur}</p>}

          <div className="boutons-panneau">
            <button type="submit" className="bouton-principal" disabled={enCours}>
              {enCours ? 'Changement en cours...' : 'Confirmer le changement'}
            </button>
            <button type="button" className="bouton-secondaire" onClick={onAnnuler} disabled={enCours}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
