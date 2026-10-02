import { useState } from 'react';
import type { FormEvent } from 'react';
import { changerMotDePasse } from '../services/auth.service';
import '../pages/classes/PanneauCreationClasse.css';

interface Props {
  onFerme: () => void;
}

export default function PanneauChangementMotDePasse({ onFerme }: Props) {
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmationNouveau, setConfirmationNouveau] = useState('');
  const [motsDePasseVisibles, setMotsDePasseVisibles] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  async function gererSoumission(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    if (nouveauMotDePasse.length < 12) {
      setErreur('Le nouveau mot de passe doit contenir au moins 12 caractères.');
      return;
    }
    if (nouveauMotDePasse !== confirmationNouveau) {
      setErreur('Les deux saisies du nouveau mot de passe ne correspondent pas.');
      return;
    }

    setEnCours(true);
    try {
      await changerMotDePasse(motDePasseActuel, nouveauMotDePasse);
      setSucces(true);
    } catch (erreurChangement: unknown) {
      const message =
        (erreurChangement as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Impossible de changer le mot de passe.';
      setErreur(message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="superposition-panneau" onClick={onFerme}>
      <div className="panneau-creation" onClick={(e) => e.stopPropagation()}>
        <h2>Changer le mot de passe</h2>

        {succes ? (
          <>
            <p className="panneau-sous-titre">Mot de passe changé avec succès.</p>
            <div className="boutons-panneau">
              <button type="button" className="bouton-principal" onClick={onFerme}>
                Fermer
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={gererSoumission}>
            <div className="champ">
              <label htmlFor="mot-de-passe-actuel">Mot de passe actuel</label>
              <input
                id="mot-de-passe-actuel"
                type={motsDePasseVisibles ? 'text' : 'password'}
                value={motDePasseActuel}
                onChange={(e) => setMotDePasseActuel(e.target.value)}
                disabled={enCours}
                autoFocus
              />
            </div>

            <div className="champ">
              <label htmlFor="nouveau-mot-de-passe">Nouveau mot de passe</label>
              <input
                id="nouveau-mot-de-passe"
                type={motsDePasseVisibles ? 'text' : 'password'}
                value={nouveauMotDePasse}
                onChange={(e) => setNouveauMotDePasse(e.target.value)}
                disabled={enCours}
                placeholder="Au moins 12 caractères"
              />
            </div>

            <div className="champ">
              <label htmlFor="confirmation-nouveau">Confirmer le nouveau mot de passe</label>
              <input
                id="confirmation-nouveau"
                type={motsDePasseVisibles ? 'text' : 'password'}
                value={confirmationNouveau}
                onChange={(e) => setConfirmationNouveau(e.target.value)}
                disabled={enCours}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={motsDePasseVisibles}
                onChange={(e) => setMotsDePasseVisibles(e.target.checked)}
              />
              Afficher les mots de passe
            </label>

            {erreur && <p className="message-erreur-panneau" role="alert">{erreur}</p>}

            <div className="boutons-panneau">
              <button type="submit" className="bouton-principal" disabled={enCours}>
                {enCours ? 'Changement en cours...' : 'Changer le mot de passe'}
              </button>
              <button type="button" className="bouton-secondaire" onClick={onFerme} disabled={enCours}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
