import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import EnTete from '../../components/EnTete';
import {
  listerCatalogueElectifs,
  ajouterCoursElectifCatalogue,
  listerCreneauxElectifsPourClasse,
  listerChoixPourCreneauEtClasse,
  assignerChoixElectif,
  retirerChoixElectif,
} from '../../services/electifs.service';
import { obtenirClasseParId } from '../../services/classes.service';
import type { CoursElectifCatalogue, CreneauElectif, ChoixElectifEtudiant } from '../../types/electifs.types';
import '../../styles/listes.css';
import './PageElectifsClasse.css';

/**
 * Écran d'assignation des choix électifs, par classe : pour chaque créneau
 * électif du semestre actuellement actif, l'administration choisit, pour
 * CHAQUE étudiant individuellement, quel cours du catalogue remplit ce
 * créneau — jamais un choix pour toute la classe à la fois, puisque deux
 * étudiants peuvent choisir différemment sous le même créneau.
 *
 * Le catalogue fourni au départ n'est jamais exhaustif : cet écran permet
 * aussi de l'étendre — un cours ajouté ici devient immédiatement
 * choisissable pour tout étudiant, sur n'importe quel créneau.
 */
const LIBELLE_TERME: Record<string, string> = { AUTOMNE: 'Automne', PRINTEMPS: 'Printemps', ETE: 'Été' };

export default function PageElectifsClasse() {
  const { id } = useParams<{ id: string }>();
  const [nomClasse, setNomClasse] = useState('');
  const [catalogue, setCatalogue] = useState<CoursElectifCatalogue[]>([]);
  const [creneaux, setCreneaux] = useState<CreneauElectif[]>([]);
  const [creneauId, setCreneauId] = useState('');
  const [termeSelectionne, setTermeSelectionne] = useState<'' | 'AUTOMNE' | 'PRINTEMPS' | 'ETE'>('');
  const [choix, setChoix] = useState<ChoixElectifEtudiant[]>([]);
  const [enChargement, setEnChargement] = useState(true);
  const [enChargementChoix, setEnChargementChoix] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState<string | null>(null);

  const [panneauAjoutOuvert, setPanneauAjoutOuvert] = useState(false);
  const [panneauStatsOuvert, setPanneauStatsOuvert] = useState(false);
  const [nouveauCode, setNouveauCode] = useState('');
  const [nouveauTitre, setNouveauTitre] = useState('');
  const [nouveauPrerequis, setNouveauPrerequis] = useState('');
  const [nouvellesHeures, setNouvellesHeures] = useState('');
  const [enCoursAjout, setEnCoursAjout] = useState(false);
  const [erreurAjout, setErreurAjout] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setEnChargement(true);
    Promise.all([obtenirClasseParId(id), listerCatalogueElectifs(id), listerCreneauxElectifsPourClasse(id)])
      .then(([classe, catalogueCharge, creneauxCharges]) => {
        setNomClasse(classe.nom);
        setCatalogue(catalogueCharge);
        setCreneaux(creneauxCharges);
        if (creneauxCharges.length > 0) {
          setCreneauId(creneauxCharges[0].id);
        }
      })
      .catch(() => setErreur('Impossible de charger cette page.'))
      .finally(() => setEnChargement(false));
  }, [id]);

  useEffect(() => {
    if (!id || !creneauId) return;
    setEnChargementChoix(true);
    listerChoixPourCreneauEtClasse(id, creneauId)
      .then(setChoix)
      .catch(() => setErreur('Impossible de charger les choix des étudiants.'))
      .finally(() => setEnChargementChoix(false));
  }, [id, creneauId]);

  async function gererChangementChoix(inscriptionId: string, codeCoursElectif: string) {
    setEnregistrementEnCours(inscriptionId);
    setErreur(null);
    try {
      if (codeCoursElectif) {
        await assignerChoixElectif(inscriptionId, creneauId, codeCoursElectif, termeSelectionne || undefined);
      } else {
        // "Non choisi" sélectionné sur un choix déjà existant — annule
        // réellement, l'étudiant redevient "pas encore choisi" (null),
        // jamais un simple retour visuel sans effet en base.
        await retirerChoixElectif(inscriptionId, creneauId);
      }
      if (id) {
        const choixMisAJour = await listerChoixPourCreneauEtClasse(id, creneauId);
        setChoix(choixMisAJour);
      }
    } catch {
      setErreur(codeCoursElectif ? "Impossible d'enregistrer ce choix." : "Impossible d'annuler ce choix.");
    } finally {
      setEnregistrementEnCours(null);
    }
  }

  async function gererAjoutCatalogue(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreurAjout(null);

    if (!nouveauCode.trim() || !nouveauTitre.trim()) {
      setErreurAjout('Le code et le titre sont requis.');
      return;
    }

    if (!id) return;

    setEnCoursAjout(true);
    try {
      await ajouterCoursElectifCatalogue(id, {
        code: nouveauCode.trim(),
        titre: nouveauTitre.trim(),
        prerequisCode: nouveauPrerequis.trim() || null,
        heures: nouvellesHeures.trim() ? Number(nouvellesHeures) : null,
        credits: 5, // tous les cours électifs de la maquette valent 5 crédits, fixé — jamais saisi
      });
      const catalogueMisAJour = await listerCatalogueElectifs(id);
      setCatalogue(catalogueMisAJour);
      setPanneauAjoutOuvert(false);
      setNouveauCode('');
      setNouveauTitre('');
      setNouveauPrerequis('');
      setNouvellesHeures('');
    } catch (erreurAjoutCatalogue: unknown) {
      const message =
        (erreurAjoutCatalogue as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Impossible d'ajouter ce cours au catalogue.";
      setErreurAjout(message);
    } finally {
      setEnCoursAjout(false);
    }
  }

  if (enChargement) {
    return (
      <div>
        <EnTete />
        <p className="ligne-vide">Chargement...</p>
      </div>
    );
  }

  // Un créneau à choix FERMÉ (Stage/Mémoire, Arabe/Français — options
  // fixes et nommées dès la maquette) ne montre que ses propres cours,
  // jamais le catalogue. Un créneau OUVERT (UE.16/20/23...) montre
  // toujours le catalogue, MÊME si un étudiant y a déjà fait un choix —
  // la présence d'un cours déjà créé ne doit jamais, à elle seule, fermer
  // le choix pour tous les autres étudiants.
  const creneauActuel = creneaux.find((c) => c.id === creneauId);
  const optionsDisponibles = creneauActuel?.choixExclusif ? creneauActuel.cours : catalogue;

  // Statistiques calculées directement depuis les choix déjà chargés à
  // l'écran — regroupe par cours choisi, compte les étudiants, jamais un
  // nouvel appel au serveur.
  const statistiquesParCours = new Map<string, { titre: string; nombre: number }>();
  for (const c of choix) {
    if (!c.choixActuel) continue;
    const existant = statistiquesParCours.get(c.choixActuel.code);
    if (existant) {
      existant.nombre += 1;
    } else {
      statistiquesParCours.set(c.choixActuel.code, { titre: c.choixActuel.titre, nombre: 1 });
    }
  }
  const statistiquesTriees = Array.from(statistiquesParCours.entries())
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.nombre - a.nombre);

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <div className="entete-page">
          <h1>Cours électifs ({nomClasse})</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="bouton-secondaire" onClick={() => setPanneauStatsOuvert(true)}>
              Voir les statistiques
            </button>
            <button className="bouton-secondaire" onClick={() => setPanneauAjoutOuvert(true)}>
              + Ajouter un cours au catalogue
            </button>
            {id && <Link to={`/classes/${id}`} className="bouton-secondaire">Retour à la classe</Link>}
          </div>
        </div>

        {erreur && <p style={{ color: 'var(--couleur-erreur)', fontSize: 13, marginBottom: 16 }}>{erreur}</p>}

        {creneaux.length === 0 ? (
          <p className="ligne-vide">
            Aucun créneau électif pour le semestre actuellement actif de cette classe.
          </p>
        ) : (
          <>
            {creneaux.length > 1 && (
              <div className="champ" style={{ maxWidth: 300, marginBottom: 20 }}>
                <label htmlFor="selecteur-creneau">Créneau électif</label>
                <select
                  id="selecteur-creneau"
                  value={creneauId}
                  onChange={(e) => setCreneauId(e.target.value)}
                >
                  {creneaux.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} ({c.credits} crédits)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="champ" style={{ maxWidth: 300, marginBottom: 20 }}>
              <label htmlFor="selecteur-terme">Terme (optionnel, pour tous les choix ci-dessous)</label>
              <select
                id="selecteur-terme"
                value={termeSelectionne}
                onChange={(e) => setTermeSelectionne(e.target.value as typeof termeSelectionne)}
              >
                <option value="">Non précisé</option>
                <option value="AUTOMNE">Automne</option>
                <option value="PRINTEMPS">Printemps</option>
                <option value="ETE">Été</option>
              </select>
            </div>

            {enChargementChoix ? (
              <p className="ligne-vide">Chargement des étudiants...</p>
            ) : (
              <>
                {choix.length > 0 && (
                  <div className="electifs-resume">
                    <span className="electifs-resume-chiffre">
                      {choix.filter((c) => c.choixActuel !== null).length} / {choix.length}
                    </span>
                    <span className="electifs-resume-texte">étudiants ont fait leur choix</span>
                    <div className="electifs-barre-progression">
                      <div
                        className="electifs-barre-progression-remplie"
                        style={{
                          width: `${(choix.filter((c) => c.choixActuel !== null).length / choix.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <table className="tableau-liste">
                  <thead>
                    <tr>
                      <th>Matricule</th>
                      <th>Étudiant</th>
                      <th>Cours électif choisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {choix.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="ligne-vide">Aucun étudiant actif dans cette classe.</td>
                      </tr>
                    ) : (
                      choix.map((c) => (
                        <tr key={c.inscriptionId}>
                          <td>{c.etudiant.matricule}</td>
                          <td>{c.etudiant.nom}</td>
                          <td>
                            <select
                              className={`select-electif ${
                                c.choixActuel ? 'select-electif-choisi' : 'select-electif-non-choisi'
                              }`}
                              value={c.choixActuel?.code ?? ''}
                              onChange={(e) => gererChangementChoix(c.inscriptionId, e.target.value)}
                              disabled={enregistrementEnCours === c.inscriptionId}
                            >
                              <option value="">Non choisi</option>
                              {optionsDisponibles.map((catalogueEntree) => (
                                <option key={catalogueEntree.code} value={catalogueEntree.code}>
                                  {catalogueEntree.titre} ({catalogueEntree.code})
                                </option>
                              ))}
                            </select>
                            {c.choixActuel && (
                              <span className="electifs-libelle-enregistrement">
                                {c.choixActuel.terme ? LIBELLE_TERME[c.choixActuel.terme] : 'Terme non précisé'}
                              </span>
                            )}
                            {enregistrementEnCours === c.inscriptionId && (
                              <span className="electifs-libelle-enregistrement">Enregistrement...</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>

      {panneauStatsOuvert && (
        <div className="superposition-panneau" onClick={() => setPanneauStatsOuvert(false)}>
          <div className="panneau-creation" onClick={(e) => e.stopPropagation()}>
            <h2>Statistiques ({creneauActuel?.code})</h2>
            <p className="panneau-sous-titre">
              {statistiquesTriees.length} cours différent{statistiquesTriees.length !== 1 ? 's' : ''} choisi
              {statistiquesTriees.length !== 1 ? 's' : ''} sur {optionsDisponibles.length} disponible
              {optionsDisponibles.length !== 1 ? 's' : ''} au catalogue.
            </p>

            {statistiquesTriees.length === 0 ? (
              <p className="ligne-vide">Aucun choix n'a encore été fait pour ce créneau.</p>
            ) : (
              <table className="tableau-liste">
                <thead>
                  <tr>
                    <th>Cours</th>
                    <th>Étudiants</th>
                  </tr>
                </thead>
                <tbody>
                  {statistiquesTriees.map((s) => (
                    <tr key={s.code}>
                      <td>{s.titre} ({s.code})</td>
                      <td>{s.nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="boutons-panneau">
              <button className="bouton-secondaire" onClick={() => setPanneauStatsOuvert(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {panneauAjoutOuvert && (
        <div className="superposition-panneau" onClick={() => setPanneauAjoutOuvert(false)}>
          <div className="panneau-creation" onClick={(e) => e.stopPropagation()}>
            <h2>Ajouter un cours au catalogue</h2>
            <p className="panneau-sous-titre">
              Ce cours devient immédiatement choisissable pour tout étudiant, sur n'importe quel créneau
              électif. Tous les cours électifs valent 5 crédits, fixé automatiquement.
            </p>

            <form onSubmit={gererAjoutCatalogue}>
              <div className="champ">
                <label htmlFor="nouveau-code">Code</label>
                <input
                  id="nouveau-code"
                  type="text"
                  value={nouveauCode}
                  onChange={(e) => setNouveauCode(e.target.value)}
                  placeholder="Ex. DROI450"
                  disabled={enCoursAjout}
                />
              </div>

              <div className="champ">
                <label htmlFor="nouveau-titre">Titre du cours</label>
                <input
                  id="nouveau-titre"
                  type="text"
                  value={nouveauTitre}
                  onChange={(e) => setNouveauTitre(e.target.value)}
                  placeholder="Ex. Droit des sociétés"
                  disabled={enCoursAjout}
                />
              </div>

              <div className="champ">
                <label htmlFor="nouveau-prerequis">Prérequis (optionnel)</label>
                <input
                  id="nouveau-prerequis"
                  type="text"
                  value={nouveauPrerequis}
                  onChange={(e) => setNouveauPrerequis(e.target.value)}
                  placeholder="Ex. DROI350"
                  disabled={enCoursAjout}
                />
              </div>

              <div className="champ">
                <label htmlFor="nouvelles-heures">Heures (optionnel)</label>
                <input
                  id="nouvelles-heures"
                  type="number"
                  min="1"
                  value={nouvellesHeures}
                  onChange={(e) => setNouvellesHeures(e.target.value)}
                  placeholder="Ex. 50"
                  disabled={enCoursAjout}
                />
              </div>

              {erreurAjout && <p className="message-erreur-panneau" role="alert">{erreurAjout}</p>}

              <div className="boutons-panneau">
                <button type="submit" className="bouton-principal" disabled={enCoursAjout}>
                  {enCoursAjout ? 'Ajout en cours...' : 'Ajouter au catalogue'}
                </button>
                <button
                  type="button"
                  className="bouton-secondaire"
                  onClick={() => setPanneauAjoutOuvert(false)}
                  disabled={enCoursAjout}
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
