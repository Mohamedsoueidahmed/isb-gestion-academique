import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EnTete from '../../components/EnTete';
import PanneauInscriptionEtudiant from './PanneauInscriptionEtudiant';
import { rechercherEtudiants } from '../../services/etudiants.service';
import { useAnneeUniversitaire } from '../../contexts/AnneeUniversitaireContext';
import type { Etudiant } from '../../types/etudiants.types';
import '../../styles/listes.css';

export default function EtudiantsPage() {
  const navigate = useNavigate();
  const { anneeSelectionneeId } = useAnneeUniversitaire();
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [recherche, setRecherche] = useState('');
  const [enChargement, setEnChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [panneauOuvert, setPanneauOuvert] = useState(false);

  function chargerEtudiants(termeRecherche: string) {
    if (!anneeSelectionneeId) return;
    setEnChargement(true);
    rechercherEtudiants(termeRecherche || undefined, anneeSelectionneeId)
      .then(setEtudiants)
      .catch(() => setErreur('Impossible de charger les étudiants.'))
      .finally(() => setEnChargement(false));
  }

  // Chargement initial, et rechargement si l'année sélectionnée change.
  useEffect(() => {
    chargerEtudiants(recherche);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneeSelectionneeId]);

  // Recherche différée : on attend une courte pause dans la frappe avant
  // d'appeler le serveur, pour ne pas envoyer une requête à chaque lettre.
  useEffect(() => {
    const delai = setTimeout(() => {
      chargerEtudiants(recherche);
    }, 300);

    return () => clearTimeout(delai);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  function gererInscriptionTerminee() {
    setPanneauOuvert(false);
    chargerEtudiants(recherche);
  }

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <div className="entete-page">
          <h1>Étudiants</h1>
          <button className="bouton-principal" onClick={() => setPanneauOuvert(true)}>
            Inscrire un étudiant
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Rechercher par nom, prénom ou matricule..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontFamily: 'var(--police-texte)',
              fontSize: 14,
              border: '1px solid var(--couleur-bordure)',
              borderRadius: 'var(--rayon-petit)',
              background: 'var(--couleur-blanc)',
            }}
          />
        </div>

        {enChargement && <p className="ligne-vide">Chargement...</p>}
        {erreur && <p className="ligne-vide" style={{ color: 'var(--couleur-erreur)' }}>{erreur}</p>}

        {!enChargement && !erreur && (
          <table className="tableau-liste">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Nom</th>
                <th>Parcours actuel</th>
                <th>Classe actuelle</th>
              </tr>
            </thead>
            <tbody>
              {etudiants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="ligne-vide">Aucun étudiant trouvé.</td>
                </tr>
              ) : (
                etudiants.map((etudiant) => {
                  const inscriptionActive = etudiant.inscriptions?.[0];
                  return (
                    <tr
                      className="ligne-cliquable"
                      key={etudiant.id}
                      onClick={() => navigate(`/etudiants/${etudiant.id}`)}
                    >
                      <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--couleur-gris-texte)' }}>
                        {etudiant.matricule}
                      </td>
                      <td>{etudiant.nom}</td>
                      <td>{inscriptionActive?.parcours.nom ?? '—'}</td>
                      <td>{inscriptionActive?.classe.nom ?? '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {panneauOuvert && (
        <PanneauInscriptionEtudiant onTermine={gererInscriptionTerminee} onAnnuler={() => setPanneauOuvert(false)} />
      )}
    </div>
  );
}
