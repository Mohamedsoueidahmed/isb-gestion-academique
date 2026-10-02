import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { connecter } from '../../services/auth.service';
import './ConnexionPage.css';

export default function ConnexionPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function gererSoumission(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      await connecter(email, motDePasse);
      navigate('/');
    } catch (erreurConnexion) {
      // Message générique volontaire, cohérent avec le backend qui ne
      // révèle jamais si c'est l'email ou le mot de passe qui est incorrect.
      setErreur('Identifiants incorrects. Vérifiez votre email et votre mot de passe.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="page-connexion">
      <div className="cadre-connexion">
        <div className="identite">
          <img src="/logo.png" alt="ISB International School of Business" className="logo-connexion" />
          <p className="nom-institution">ISB International School of Business</p>
          <p className="sous-titre">Plateforme de gestion académique</p>
        </div>

        <div className="carte-connexion">
          <h1>Connexion à l'espace administration</h1>

          <form onSubmit={gererSoumission}>
            <div className="champ">
              <label htmlFor="email">Adresse e-mail</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={enCours}
                required
                autoFocus
              />
            </div>

            <div className="champ">
              <label htmlFor="motdepasse">Mot de passe</label>
              <div className="champ-mot-de-passe">
                <input
                  type={motDePasseVisible ? 'text' : 'password'}
                  id="motdepasse"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  disabled={enCours}
                  required
                />
                <button
                  type="button"
                  className="bouton-afficher-mot-de-passe"
                  onClick={() => setMotDePasseVisible((v) => !v)}
                  tabIndex={-1}
                >
                  {motDePasseVisible ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>

            {erreur && <p className="message-erreur" role="alert">{erreur}</p>}

            <button type="submit" className="bouton-connexion" disabled={enCours}>
              {enCours ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="pied-connexion">Accès réservé à l'administration académique.</p>
      </div>
    </div>
  );
}
