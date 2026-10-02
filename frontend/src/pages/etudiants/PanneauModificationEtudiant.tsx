import { useState } from 'react';
import type { FormEvent } from 'react';
import { modifierEtudiant } from '../../services/etudiants.service';
import type { Etudiant } from '../../types/etudiants.types';
import '../classes/PanneauCreationClasse.css';

interface Props {
  etudiant: Etudiant;
  onModifie: (etudiant: Etudiant) => void;
  onAnnuler: () => void;
}

export default function PanneauModificationEtudiant({ etudiant, onModifie, onAnnuler }: Props) {
  const [matricule, setMatricule] = useState(etudiant.matricule);
  const [nom, setNom] = useState(etudiant.nom);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function gererSoumission(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    if (!matricule.trim() || !nom.trim()) {
      setErreur('Tous les champs sont requis.');
      return;
    }

    setEnCours(true);
    try {
      const etudiantModifie = await modifierEtudiant(etudiant.id, {
        matricule: matricule.trim(),
        nom: nom.trim(),
      });
      onModifie(etudiantModifie);
    } catch (erreurModification: unknown) {
      const message =
        (erreurModification as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Une erreur est survenue lors de la modification.';
      setErreur(message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="superposition-panneau" onClick={onAnnuler}>
      <div className="panneau-creation" onClick={(e) => e.stopPropagation()}>
        <h2>Modifier la fiche</h2>
        <p className="panneau-sous-titre">Corrige le nom, ou le matricule.</p>

        <form onSubmit={gererSoumission}>
          <div className="champ">
            <label htmlFor="matricule">Matricule</label>
            <input
              id="matricule"
              type="text"
              value={matricule}
              onChange={(e) => setMatricule(e.target.value)}
              disabled={enCours}
              autoFocus
            />
          </div>

          <div className="champ">
            <label htmlFor="nom">Nom</label>
            <input id="nom" type="text" value={nom} onChange={(e) => setNom(e.target.value)} disabled={enCours} />
          </div>

          {erreur && <p className="message-erreur-panneau" role="alert">{erreur}</p>}

          <div className="boutons-panneau">
            <button type="submit" className="bouton-principal" disabled={enCours}>
              {enCours ? 'Enregistrement...' : 'Enregistrer'}
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
