import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import EnTete from '../../components/EnTete';
import { listerNiveauxParParcours } from '../../services/referentiel.service';
import {
  listerMatieresParNiveau,
  marquerDispense,
  retirerDispense,
  obtenirParcoursDeLInscription,
} from '../../services/dispenses.service';
import type { ParcoursDeLInscription } from '../../services/dispenses.service';
import type { Niveau } from '../../types/classes.types';
import type { MatiereAvecStatutDispense } from '../../types/dispenses.types';

/**
 * Pour un étudiant transféré d'une autre université, qui a déjà validé
 * certaines matières là-bas — jamais pour un étudiant qui commence un
 * cycle (L1, M1) : rien à dispenser au tout début d'un programme.
 * Jamais les électifs non plus : un électif reste toujours "un choix
 * parmi plusieurs options", jamais une matière unique et fixe qu'on
 * pourrait dispenser directement — seules les matières obligatoires
 * (un seul cours fixe par UE) sont proposées ici.
 *
 * Le parcours n'est jamais choisi ici — il est déjà déterminé par
 * l'inscription de cet étudiant précis, jamais les six formations de
 * l'école. Le sélecteur de niveau, lui, reste libre à l'intérieur de CE
 * parcours : un étudiant transféré peut avoir des équivalences touchant
 * plusieurs niveaux à la fois (deux années validées ailleurs, par
 * exemple), jamais seulement celui où il entre.
 */
export default function PageDispenses() {
  const { inscriptionId } = useParams<{ inscriptionId: string }>();

  const [parcoursInfo, setParcoursInfo] = useState<ParcoursDeLInscription | null>(null);
  const [niveauxListe, setNiveauxListe] = useState<Niveau[]>([]);
  const [niveauId, setNiveauId] = useState('');

  const [matieres, setMatieres] = useState<MatiereAvecStatutDispense[]>([]);
  const [chargementMatieres, setChargementMatieres] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [universiteParCours, setUniversiteParCours] = useState<Record<string, string>>({});
  const [noteParCours, setNoteParCours] = useState<Record<string, string>>({});
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  useEffect(() => {
    if (!inscriptionId) return;
    obtenirParcoursDeLInscription(inscriptionId)
      .then((info) => {
        setParcoursInfo(info);
        return listerNiveauxParParcours(info.parcoursId);
      })
      .then(setNiveauxListe)
      .catch(() => setErreur("Impossible de récupérer le parcours de cet étudiant."));
  }, [inscriptionId]);

  useEffect(() => {
    if (!inscriptionId || !niveauId) {
      setMatieres([]);
      return;
    }
    setChargementMatieres(true);
    setErreur(null);
    listerMatieresParNiveau(inscriptionId, niveauId)
      .then(setMatieres)
      .catch(() => setErreur('Impossible de récupérer les matières de ce niveau.'))
      .finally(() => setChargementMatieres(false));
  }, [inscriptionId, niveauId]);

  async function gererMarquerDispense(coursId: string) {
    if (!inscriptionId) return;
    const universite = universiteParCours[coursId]?.trim();
    if (!universite) {
      setErreur("Précisez l'université d'origine avant d'enregistrer.");
      return;
    }
    const noteTexte = noteParCours[coursId]?.trim();
    const note = Number(noteTexte);
    if (!noteTexte || Number.isNaN(note) || note < 0 || note > 20) {
      setErreur('Précisez la note retenue (entre 0 et 20) avant d\'enregistrer.');
      return;
    }
    setActionEnCours(coursId);
    setErreur(null);
    try {
      await marquerDispense(inscriptionId, coursId, universite, note);
      const misAJour = await listerMatieresParNiveau(inscriptionId, niveauId);
      setMatieres(misAJour);
    } catch (erreurAction: unknown) {
      const message =
        (erreurAction as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Impossible de marquer cette matière comme dispensée.';
      setErreur(message);
    } finally {
      setActionEnCours(null);
    }
  }

  async function gererRetraitDispense(coursId: string) {
    if (!inscriptionId) return;
    setActionEnCours(coursId);
    setErreur(null);
    try {
      await retirerDispense(inscriptionId, coursId);
      const misAJour = await listerMatieresParNiveau(inscriptionId, niveauId);
      setMatieres(misAJour);
    } catch (erreurAction: unknown) {
      const message =
        (erreurAction as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Impossible de retirer cette dispense.';
      setErreur(message);
    } finally {
      setActionEnCours(null);
    }
  }

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <Link to="/etudiants" className="panneau-sous-titre">
          ← Retour aux étudiants
        </Link>

        <h1>Dispenses</h1>
        <p className="panneau-sous-titre">
          Pour un étudiant venu d'une autre université, qui a déjà validé certaines matières là-bas. Choisissez le
          niveau concerné, puis marquez les matières déjà validées, en précisant où et avec quelle note. Cette note
          ne sert qu'à garder la moyenne générale juste, jamais affichée comme une vraie note, jamais utilisée pour
          décider si la matière est validée (elle l'est déjà, par la dispense elle-même).
        </p>

        <div className="section-fiche">
          {parcoursInfo && (
            <p className="panneau-sous-titre" style={{ marginTop: 0 }}>
              {parcoursInfo.formationNom}, {parcoursInfo.parcoursNom}
            </p>
          )}

          <div className="champ">
            <label htmlFor="niveau">Niveau</label>
            <select
              id="niveau"
              value={niveauId}
              onChange={(e) => setNiveauId(e.target.value)}
              disabled={niveauxListe.length === 0}
            >
              <option value="">Choisir un niveau</option>
              {niveauxListe.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.libelle}
                </option>
              ))}
            </select>
          </div>

          {erreur && <p className="message-erreur-panneau" role="alert">{erreur}</p>}
        </div>

        {niveauId && (
          <div className="section-fiche">
            {chargementMatieres ? (
              <p className="ligne-vide">Chargement...</p>
            ) : matieres.length === 0 ? (
              <p className="ligne-vide">Aucune matière obligatoire pour ce niveau.</p>
            ) : (
              <table className="tableau-liste">
                <thead>
                  <tr>
                    <th>Matière</th>
                    <th>Semestre</th>
                    <th>Statut</th>
                    <th>Université d'origine</th>
                    <th>Note retenue</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {matieres.map((m) => (
                    <tr key={m.coursId}>
                      <td>{m.titre} ({m.code})</td>
                      <td>{m.semestre}</td>
                      <td>
                        {m.dispense ? (
                          <span className="badge-etat badge-valide">Dispensé(e)</span>
                        ) : m.dejaAffecte ? (
                          <span className="badge-etat">Déjà affecté</span>
                        ) : (
                          <span className="ligne-vide">Non affecté</span>
                        )}
                      </td>
                      <td>
                        {m.dispense ? (
                          m.universiteOrigine
                        ) : m.dejaAffecte ? (
                          '—'
                        ) : (
                          <input
                            type="text"
                            placeholder="Ex. Université de Nouakchott"
                            value={universiteParCours[m.coursId] ?? ''}
                            onChange={(e) =>
                              setUniversiteParCours((precedent) => ({ ...precedent, [m.coursId]: e.target.value }))
                            }
                          />
                        )}
                      </td>
                      <td>
                        {m.dispense ? (
                          m.noteRetenue
                        ) : m.dejaAffecte ? (
                          '—'
                        ) : (
                          <input
                            type="number"
                            min={0}
                            max={20}
                            step={0.01}
                            placeholder="Ex. 12.5"
                            style={{ width: 70 }}
                            value={noteParCours[m.coursId] ?? ''}
                            onChange={(e) =>
                              setNoteParCours((precedent) => ({ ...precedent, [m.coursId]: e.target.value }))
                            }
                          />
                        )}
                      </td>
                      <td>
                        {m.dispense ? (
                          <button
                            className="bouton-secondaire"
                            onClick={() => gererRetraitDispense(m.coursId)}
                            disabled={actionEnCours === m.coursId}
                          >
                            {actionEnCours === m.coursId ? '...' : 'Retirer'}
                          </button>
                        ) : !m.dejaAffecte ? (
                          <button
                            className="bouton-secondaire"
                            onClick={() => gererMarquerDispense(m.coursId)}
                            disabled={actionEnCours === m.coursId}
                          >
                            {actionEnCours === m.coursId ? '...' : 'Dispenser'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
