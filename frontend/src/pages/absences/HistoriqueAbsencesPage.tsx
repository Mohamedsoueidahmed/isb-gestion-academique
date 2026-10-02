import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EnTete from '../../components/EnTete';
import { listerClasses } from '../../services/classes.service';
import { listerCoursAffectesParTerme } from '../../services/lots.service';
import { obtenirHistoriqueSeancesParCours } from '../../services/absences.service';
import { useAnneeUniversitaire } from '../../contexts/AnneeUniversitaireContext';
import type { Classe } from '../../types/classes.types';
import type { GroupeCoursTerme } from '../../types/lots.types';
import type { SeanceHistorique } from '../../types/absences.types';
import '../../styles/listes.css';
import './AbsencesPage.css';

const LIBELLE_TERME: Record<string, string> = { AUTOMNE: 'Automne', PRINTEMPS: 'Printemps', ETE: 'Été' };

/**
 * Consultation, jour par jour, des séances déjà enregistrées pour un cours
 * et une classe — jamais de saisie ici, voir AbsencesPage pour ça.
 */
export default function HistoriqueAbsencesPage() {
  const { anneeSelectionneeId } = useAnneeUniversitaire();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [groupesTerme, setGroupesTerme] = useState<GroupeCoursTerme[]>([]);
  const [termeActif, setTermeActif] = useState<string | null>(null);
  const [seances, setSeances] = useState<SeanceHistorique[]>([]);

  const [classeId, setClasseId] = useState('');
  const [coursId, setCoursId] = useState('');

  const [chargementCours, setChargementCours] = useState(false);
  const [chargementSeances, setChargementSeances] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setClasseId('');
    if (!anneeSelectionneeId) return;
    listerClasses({ anneeUniversitaireId: anneeSelectionneeId }).then(setClasses);
  }, [anneeSelectionneeId]);

  useEffect(() => {
    setCoursId('');
    setTermeActif(null);
    setSeances([]);

    if (!classeId) {
      setGroupesTerme([]);
      return;
    }

    setChargementCours(true);
    listerCoursAffectesParTerme(classeId)
      .then((groupes) => {
        setGroupesTerme(groupes);
        setTermeActif(groupes[0]?.terme ?? null);
      })
      .finally(() => setChargementCours(false));
  }, [classeId]);

  function gererChangementTerme(terme: string | null) {
    setTermeActif(terme);
    setCoursId('');
    setSeances([]);
  }

  useEffect(() => {
    setErreur(null);
    if (!classeId || !coursId) {
      setSeances([]);
      return;
    }

    setChargementSeances(true);
    obtenirHistoriqueSeancesParCours(classeId, coursId)
      .then(setSeances)
      .catch(() => setErreur("Impossible de charger l'historique des séances."))
      .finally(() => setChargementSeances(false));
  }, [classeId, coursId]);

  function formaterDate(dateSeance: string): string {
    return new Date(dateSeance).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <div className="entete-page">
          <h1>Historique des absences</h1>
          <Link to="/absences" className="bouton-secondaire">Retour à la saisie</Link>
        </div>

        <div className="selecteurs-absences">
          <div className="champ-selecteur">
            <label htmlFor="classe">Classe</label>
            <select id="classe" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">Sélectionner une classe...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
        </div>

        {classeId && !chargementCours && groupesTerme.length === 0 && (
          <p className="ligne-vide">Aucun cours réellement affecté dans cette classe pour l'instant.</p>
        )}

        {groupesTerme.length > 0 && (
          <div className="onglets-terme">
            {groupesTerme.map((groupe) => (
              <button
                key={groupe.terme ?? 'sans-terme'}
                className={`onglet-terme ${termeActif === groupe.terme ? 'onglet-terme-actif' : ''}`}
                onClick={() => gererChangementTerme(groupe.terme)}
              >
                {LIBELLE_TERME[groupe.terme ?? ''] ?? 'Sans terme'}
              </button>
            ))}
          </div>
        )}

        {groupesTerme.length > 0 && (
          <div className="selecteurs-absences">
            <div className="champ-selecteur">
              <label htmlFor="cours">Cours</label>
              <select
                id="cours"
                value={coursId}
                onChange={(e) => setCoursId(e.target.value)}
                disabled={chargementCours}
              >
                <option value="">{chargementCours ? 'Chargement...' : 'Sélectionner un cours...'}</option>
                {(groupesTerme.find((g) => g.terme === termeActif)?.cours ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.titre} ({c.code})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {erreur && <p className="ligne-vide" style={{ color: 'var(--couleur-erreur)' }}>{erreur}</p>}

        {chargementSeances && <p className="ligne-vide">Chargement...</p>}

        {!chargementSeances && classeId && coursId && (
          seances.length === 0 ? (
            <p className="ligne-vide">Aucune séance encore enregistrée pour ce cours dans cette classe.</p>
          ) : (
            <div className="liste-seances-historique">
              {seances.map((seance) => (
                <div className="carte-seance" key={seance.dateSeance}>
                  <div className="carte-seance-entete">
                    <span className="carte-seance-date">{formaterDate(seance.dateSeance)}</span>
                    {seance.absents.length === 0 ? (
                      <span className="compteur-tous-presents">Tout le monde est présent</span>
                    ) : (
                      <span className="compteur-absents">
                        {seance.absents.length} absent{seance.absents.length !== 1 ? 's' : ''} sur {seance.totalInscrits}
                      </span>
                    )}
                  </div>

                  {seance.absents.length > 0 && (
                    <ul className="liste-absents-seance">
                      {seance.absents.map((etu) => (
                        <li key={etu.matricule}>{etu.nom} ({etu.matricule})</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
