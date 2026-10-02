import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import EnTete from '../../components/EnTete';
import { obtenirClasseParId } from '../../services/classes.service';
import { listerEtudiantsParCours, telechargerEtudiantsUnCoursPdf, telechargerEtudiantsTousCoursPdf } from '../../services/lots.service';
import type { ClasseDetail } from '../../types/classes.types';
import type { GroupeEtudiantsParCours } from '../../types/lots.types';
import '../../styles/listes.css';

const LIBELLE_TERME: Record<string, string> = { AUTOMNE: 'Automne', PRINTEMPS: 'Printemps', ETE: 'Été' };

/**
 * Qui est affecté à quel cours, dans une classe donnée — jamais la
 * même chose que "qui est dans cette classe" : le système de lots
 * flexibles fait que deux étudiants de la même classe peuvent très
 * bien suivre des cours différents. Groupé par Terme, puis par cours.
 */
export default function PageEtudiantsParCours() {
  const { id } = useParams<{ id: string }>();

  const [classe, setClasse] = useState<ClasseDetail | null>(null);
  const [groupes, setGroupes] = useState<GroupeEtudiantsParCours[]>([]);
  const [enChargement, setEnChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([obtenirClasseParId(id), listerEtudiantsParCours(id)])
      .then(([classeChargee, groupesCharges]) => {
        setClasse(classeChargee);
        setGroupes(groupesCharges);
      })
      .catch(() => setErreur('Impossible de récupérer les informations de cette classe.'))
      .finally(() => setEnChargement(false));
  }, [id]);

  if (enChargement) {
    return (
      <div>
        <EnTete />
        <p className="ligne-vide">Chargement...</p>
      </div>
    );
  }

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        {id && (
          <Link to={`/classes/${id}`} className="panneau-sous-titre">
            ← Retour à la classe
          </Link>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Étudiants par cours{classe ? `, ${classe.nom}` : ''}</h1>
          {id && classe && groupes.length > 0 && (
            <button
              className="bouton-secondaire"
              onClick={() => telechargerEtudiantsTousCoursPdf(id, classe.nom)}
            >
              Tout télécharger (PDF)
            </button>
          )}
        </div>

        {erreur && <p className="message-erreur-panneau" role="alert">{erreur}</p>}

        {!erreur && groupes.length === 0 && (
          <p className="ligne-vide">Aucun cours affecté pour le moment dans cette classe.</p>
        )}

        {groupes.map((groupe) => (
          <div key={groupe.terme ?? 'sans-terme'} className="section-fiche">
            <h2>{groupe.terme ? LIBELLE_TERME[groupe.terme] : 'Sans Terme précisé'}</h2>

            {groupe.cours.map((cours) => (
              <div key={cours.id} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{cours.titre} ({cours.code}), UE {cours.ueCode}</strong>
                  {id && (
                    <button
                      className="bouton-secondaire"
                      style={{ padding: '2px 10px', fontSize: 12 }}
                      onClick={() => telechargerEtudiantsUnCoursPdf(id, cours.id, cours.code)}
                    >
                      Télécharger (PDF)
                    </button>
                  )}
                </div>
                <p className="panneau-sous-titre" style={{ margin: '4px 0 8px' }}>
                  {cours.etudiants.length} étudiant(s)
                </p>
                {cours.etudiants.length === 0 ? (
                  <p className="ligne-vide">Aucun étudiant affecté.</p>
                ) : (
                  <table className="tableau-liste">
                    <thead>
                      <tr>
                        <th>Matricule</th>
                        <th>Nom</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cours.etudiants.map((e) => (
                        <tr key={e.matricule}>
                          <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{e.matricule}</td>
                          <td>{e.nom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
