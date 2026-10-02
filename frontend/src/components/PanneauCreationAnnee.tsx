import { useState } from 'react';
import type { FormEvent } from 'react';
import { creerAnneeUniversitaire } from '../services/referentiel.service';
import type { AnneeUniversitaire } from '../types/classes.types';
import '../pages/classes/PanneauCreationClasse.css';

interface Props {
  onAnneeCreee: (annee: AnneeUniversitaire) => void;
  onAnnuler: () => void;
}

export default function PanneauCreationAnnee({ onAnneeCreee, onAnnuler }: Props) {
  const [libelle, setLibelle] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function gererSoumission(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    if (!/^\d{4}-\d{4}$/.test(libelle)) {
      setErreur('Le libellé doit être au format AAAA-AAAA (ex. 2027-2028).');
      return;
    }
    if (!dateDebut || !dateFin) {
      setErreur('Les deux dates sont requises.');
      return;
    }

    setEnCours(true);
    try {
      const resultat = await creerAnneeUniversitaire({ libelle, dateDebut, dateFin });
      onAnneeCreee(resultat.annee);
    } catch (erreurCreation: unknown) {
      const message =
        (erreurCreation as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Une erreur est survenue lors de la création.';
      setErreur(message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="superposition-panneau" onClick={onAnnuler}>
      <div className="panneau-creation" onClick={(e) => e.stopPropagation()}>
        <h2>Créer une année universitaire</h2>
        <p className="panneau-sous-titre">
          Ex. 2027-2028. Les 9 classes (3 parcours × 3 niveaux) sont créées automatiquement.
        </p>

        <form onSubmit={gererSoumission}>
          <div className="champ">
            <label htmlFor="libelle">Libellé</label>
            <input
              id="libelle"
              type="text"
              placeholder="2027-2028"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              disabled={enCours}
              autoFocus
            />
          </div>

          <div className="rangee-deux-champs">
            <div className="champ">
              <label htmlFor="dateDebut">Date de début</label>
              <input
                id="dateDebut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                disabled={enCours}
              />
            </div>
            <div className="champ">
              <label htmlFor="dateFin">Date de fin</label>
              <input
                id="dateFin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                disabled={enCours}
              />
            </div>
          </div>

          {erreur && <p className="message-erreur-panneau" role="alert">{erreur}</p>}

          <div className="boutons-panneau">
            <button type="submit" className="bouton-principal" disabled={enCours}>
              {enCours ? 'Création en cours...' : "Créer l'année"}
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
