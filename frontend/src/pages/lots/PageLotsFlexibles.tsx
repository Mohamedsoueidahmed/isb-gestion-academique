import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import EnTete from '../../components/EnTete';
import { obtenirClasseParId } from '../../services/classes.service';
import {
  obtenirStatistiquesDemande,
  obtenirHistoriqueLots,
  creerEtOuvrirLot,
  fermerLot,
  ajouterCoursAuLot,
  retirerCoursDuLot,
  obtenirEtatParcoursFlexible,
  exprimerLotSouhaits,
  retirerSouhait,
  debloquerPrerequis,
} from '../../services/lots.service';
import type { ClasseDetail } from '../../types/classes.types';
import type { StatistiqueDemandeCours, EtatParcoursFlexible, Lot } from '../../types/lots.types';
import '../../styles/listes.css';
import './PageLotsFlexibles.css';

const TAILLE_LOT_MAX = 5;

/**
 * Écran du parcours flexible, par classe (donc par niveau/parcours) :
 * chaque étudiant progresse à son propre rythme, cours par cours, par
 * VRAIS LOTS de 2 à 5 souhaits soumis ensemble.
 *
 * Un lot, une fois créé, reste OUVERT jusqu'à ce qu'on le ferme
 * explicitement (voir l'historique en bas) : tant qu'il est ouvert, tout
 * NOUVEAU souhait sur un de ses cours s'inscrit immédiatement, sans
 * nouvelle confirmation — le lot agit comme une porte restée ouverte.
 * Fermer un lot n'affecte jamais rétroactivement qui est déjà inscrit,
 * seulement les inscriptions automatiques futures.
 *
 * Un cours n'est verrouillé QUE par un prérequis manquant, ou par la fin
 * de cycle (Stage/Mémoire, tant que tout le reste du cycle n'est pas
 * validé) — aucune règle d'ordre par semestre. Tout ce calcul se fait
 * côté serveur ; cet écran affiche seulement ce qui en résulte.
 */
export default function PageLotsFlexibles() {
  const { id } = useParams<{ id: string }>();
  const [classe, setClasse] = useState<ClasseDetail | null>(null);
  const [statistiques, setStatistiques] = useState<StatistiqueDemandeCours[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [etats, setEtats] = useState<Map<string, EtatParcoursFlexible>>(new Map());
  const [selections, setSelections] = useState<Map<string, Set<string>>>(new Map());
  const [coursAOuvrir, setCoursAOuvrir] = useState<Set<string>>(new Set());
  const [termeSelectionne, setTermeSelectionne] = useState<'' | 'AUTOMNE' | 'PRINTEMPS' | 'ETE'>('');
  const [lotEnEdition, setLotEnEdition] = useState<string | null>(null);
  const [enChargement, setEnChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [messageOuverture, setMessageOuverture] = useState<string | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    chargerTout(id);
  }, [id]);

  async function chargerTout(classeId: string) {
    setEnChargement(true);
    setErreur(null);
    try {
      const classeChargee = await obtenirClasseParId(classeId);
      setClasse(classeChargee);
      await rafraichirStatistiques(classeChargee.niveauId);
      await rafraichirHistoriqueLots(classeChargee.niveauId);
      await rafraichirTousLesEtats(classeChargee);
    } catch {
      setErreur('Impossible de charger les données du parcours flexible.');
    } finally {
      setEnChargement(false);
    }
  }

  async function rafraichirStatistiques(niveauId: string) {
    setStatistiques(await obtenirStatistiquesDemande(niveauId));
  }

  async function rafraichirHistoriqueLots(niveauId: string) {
    setLots(await obtenirHistoriqueLots(niveauId));
  }

  async function rafraichirTousLesEtats(classeActuelle: ClasseDetail) {
    const inscriptionsActives = classeActuelle.inscriptions.filter(
      (i) => i.statutInscription === 'ACTIVE' && i.etudiant.statut !== 'BLOQUE'
    );
    const nouveauxEtats = new Map<string, EtatParcoursFlexible>();
    for (const inscription of inscriptionsActives) {
      nouveauxEtats.set(inscription.id, await obtenirEtatParcoursFlexible(inscription.id));
    }
    setEtats(nouveauxEtats);
  }

  async function rafraichirUnEtat(inscriptionId: string) {
    const etat = await obtenirEtatParcoursFlexible(inscriptionId);
    setEtats((precedent) => new Map(precedent).set(inscriptionId, etat));
  }

  function extraireMessageErreur(erreurBrute: unknown, repli: string): string {
    return (erreurBrute as { response?: { data?: { message?: string } } })?.response?.data?.message ?? repli;
  }

  function basculerSelection(inscriptionId: string, coursId: string) {
    setSelections((precedent) => {
      const copie = new Map(precedent);
      const ensemble = new Set(copie.get(inscriptionId) ?? []);
      if (ensemble.has(coursId)) {
        ensemble.delete(coursId);
      } else if (ensemble.size < TAILLE_LOT_MAX) {
        ensemble.add(coursId);
      }
      copie.set(inscriptionId, ensemble);
      return copie;
    });
  }

  async function gererRetraitSouhait(inscriptionId: string, coursId: string) {
    const cle = `retrait-${inscriptionId}-${coursId}`;
    setActionEnCours(cle);
    setErreur(null);
    try {
      await retirerSouhait(inscriptionId, coursId);
      await rafraichirUnEtat(inscriptionId);
      if (classe) await rafraichirStatistiques(classe.niveauId);
    } catch (erreurAction: unknown) {
      setErreur(extraireMessageErreur(erreurAction, 'Une erreur est survenue.'));
    } finally {
      setActionEnCours(null);
    }
  }

  async function gererSoumissionLot(inscriptionId: string, minimumRequis: number) {
    const selectionnes = Array.from(selections.get(inscriptionId) ?? []);
    if (selectionnes.length < minimumRequis) {
      setErreur(
        minimumRequis <= 1
          ? 'Sélectionnez au moins 1 cours.'
          : `Sélectionnez entre ${minimumRequis} et ${TAILLE_LOT_MAX} cours.`
      );
      return;
    }

    setActionEnCours(`lot-${inscriptionId}`);
    setErreur(null);
    try {
      await exprimerLotSouhaits(inscriptionId, selectionnes);
      setSelections((precedent) => {
        const copie = new Map(precedent);
        copie.delete(inscriptionId);
        return copie;
      });
      await rafraichirUnEtat(inscriptionId);
      if (classe) {
        await rafraichirStatistiques(classe.niveauId);
        // Un souhait peut s'être inscrit immédiatement si un lot est déjà
        // ouvert sur un de ces cours — l'historique doit refléter ça tout
        // de suite (le nombre d'inscrits dans le lot concerné a changé).
        await rafraichirHistoriqueLots(classe.niveauId);
      }
    } catch (erreurAction: unknown) {
      setErreur(extraireMessageErreur(erreurAction, "Une erreur est survenue lors de la soumission du lot."));
    } finally {
      setActionEnCours(null);
    }
  }

  async function gererDeblocage(inscriptionId: string, coursId: string) {
    const cle = `debloquer-${inscriptionId}-${coursId}`;
    setActionEnCours(cle);
    setErreur(null);
    try {
      await debloquerPrerequis(inscriptionId, coursId);
      await rafraichirUnEtat(inscriptionId);
    } catch (erreurAction: unknown) {
      setErreur(extraireMessageErreur(erreurAction, 'Une erreur est survenue.'));
    } finally {
      setActionEnCours(null);
    }
  }

  function basculerCoursAOuvrir(coursId: string) {
    setCoursAOuvrir((precedent) => {
      const copie = new Set(precedent);
      if (copie.has(coursId)) {
        copie.delete(coursId);
      } else {
        copie.add(coursId);
      }
      return copie;
    });
  }

  /**
   * Un Terme déjà fermé (au moins un lot existant pour lui, et tous
   * FERME) ne doit plus être proposé pour un NOUVEAU lot — le fermer
   * signifie "plus aucune nouvelle inscription pour ce Terme", donc en
   * créer un autre avec le même nom contredirait cette décision. Un
   * Terme jamais utilisé, ou encore ouvert (au moins un de ses lots
   * l'est), reste disponible normalement.
   */
  function termeEstFerme(terme: 'AUTOMNE' | 'PRINTEMPS' | 'ETE'): boolean {
    const lotsDeCeTerme = lots.filter((l) => l.terme === terme);
    return lotsDeCeTerme.length > 0 && lotsDeCeTerme.every((l) => l.statut === 'FERME');
  }

  /**
   * Crée un vrai lot OUVERT pour tout le niveau, avec les cours cochés
   * dans la statistique — pas un à la fois. Reste ouvert ensuite : tout
   * nouveau souhait sur ces cours s'inscrira automatiquement, jusqu'à ce
   * qu'on le ferme explicitement dans l'historique ci-dessous.
   */
  async function gererCreationLot() {
    if (!classe || coursAOuvrir.size === 0) return;
    setActionEnCours('creer-lot');
    setErreur(null);
    setMessageOuverture(null);
    try {
      const resultat = await creerEtOuvrirLot(
        classe.niveauId,
        Array.from(coursAOuvrir),
        termeSelectionne || undefined
      );
      setMessageOuverture(
        `Lot ${resultat.lot.numero} créé et ouvert : ${resultat.convertis.length} inscription${resultat.convertis.length > 1 ? 's' : ''} au total.` +
          (resultat.laissesEnAttente.length > 0
            ? ` ${resultat.laissesEnAttente.length} laissée${resultat.laissesEnAttente.length > 1 ? 's' : ''} en attente (déjà à 5 cours actifs).`
            : '')
      );
      setCoursAOuvrir(new Set());
      setTermeSelectionne('');
      await rafraichirStatistiques(classe.niveauId);
      await rafraichirHistoriqueLots(classe.niveauId);
      await rafraichirTousLesEtats(classe);
    } catch (erreurAction: unknown) {
      setErreur(extraireMessageErreur(erreurAction, 'Une erreur est survenue lors de la création du lot.'));
    } finally {
      setActionEnCours(null);
    }
  }

  async function gererFermetureLot(lotId: string) {
    if (!classe) return;
    setActionEnCours(`fermer-${lotId}`);
    setErreur(null);
    try {
      await fermerLot(lotId);
      await rafraichirHistoriqueLots(classe.niveauId);
    } catch (erreurAction: unknown) {
      setErreur(extraireMessageErreur(erreurAction, 'Une erreur est survenue lors de la fermeture du lot.'));
    } finally {
      setActionEnCours(null);
    }
  }

  async function gererAjoutCoursAuLot(lotId: string, coursId: string) {
    if (!classe) return;
    setActionEnCours(`ajouter-${lotId}-${coursId}`);
    setErreur(null);
    try {
      await ajouterCoursAuLot(lotId, coursId);
      await rafraichirStatistiques(classe.niveauId);
      await rafraichirHistoriqueLots(classe.niveauId);
      await rafraichirTousLesEtats(classe);
    } catch (erreurAction: unknown) {
      setErreur(extraireMessageErreur(erreurAction, 'Impossible d\'ajouter ce cours au lot.'));
    } finally {
      setActionEnCours(null);
    }
  }

  async function gererRetraitCoursDuLot(lotId: string, coursId: string) {
    if (!classe) return;
    setActionEnCours(`retirer-${lotId}-${coursId}`);
    setErreur(null);
    try {
      await retirerCoursDuLot(lotId, coursId);
      await rafraichirStatistiques(classe.niveauId);
      await rafraichirHistoriqueLots(classe.niveauId);
      await rafraichirTousLesEtats(classe);
    } catch (erreurAction: unknown) {
      setErreur(extraireMessageErreur(erreurAction, 'Impossible de retirer ce cours du lot.'));
    } finally {
      setActionEnCours(null);
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

  const prochainNumero = (lots[0]?.numero ?? 0) + 1;

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <div className="entete-page">
          <h1>Parcours flexible ({classe?.nom})</h1>
          {id && <Link to={`/classes/${id}`} className="bouton-secondaire">Retour à la classe</Link>}
        </div>

        {erreur && <p className="message-erreur-panneau" role="alert">{erreur}</p>}
        {messageOuverture && <p className="panneau-sous-titre">{messageOuverture}</p>}

        <h2>Statistique de demande</h2>
        <p className="panneau-sous-titre">
          Combien d'étudiants souhaitent réellement chaque cours. Cochez ceux que vous voulez ouvrir
          ensemble, puis créez le lot. Il reste ouvert ensuite : les nouveaux souhaits s'y inscrivent
          seuls, jusqu'à ce que vous le fermiez dans l'historique en bas.
        </p>
        {statistiques.length === 0 ? (
          <p className="ligne-vide">Aucun souhait exprimé pour l'instant sur ce niveau.</p>
        ) : (
          <>
            <table className="tableau-liste">
              <thead>
                <tr>
                  <th></th>
                  <th>Semestre</th>
                  <th>UE</th>
                  <th>Cours</th>
                  <th>Souhaits</th>
                </tr>
              </thead>
              <tbody>
                {statistiques.map((s) => (
                  <tr key={s.coursId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={coursAOuvrir.has(s.coursId)}
                        onChange={() => basculerCoursAOuvrir(s.coursId)}
                        disabled={actionEnCours === 'creer-lot'}
                      />
                    </td>
                    <td>{s.semestreLibelle}</td>
                    <td>{s.ueCode}</td>
                    <td>{s.titre} ({s.code})</td>
                    <td>{s.nombreSouhaits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
              <select
                value={termeSelectionne}
                onChange={(e) => setTermeSelectionne(e.target.value as typeof termeSelectionne)}
                disabled={actionEnCours === 'creer-lot'}
              >
                <option value="">Terme (optionnel)</option>
                {!termeEstFerme('AUTOMNE') && <option value="AUTOMNE">Automne</option>}
                {!termeEstFerme('PRINTEMPS') && <option value="PRINTEMPS">Printemps</option>}
                {!termeEstFerme('ETE') && <option value="ETE">Été</option>}
              </select>
              <button
                className="bouton-principal"
                onClick={gererCreationLot}
                disabled={actionEnCours === 'creer-lot' || coursAOuvrir.size === 0}
              >
                {actionEnCours === 'creer-lot'
                  ? 'Création...'
                  : `Créer le lot ${prochainNumero} (${coursAOuvrir.size} cours coché${coursAOuvrir.size > 1 ? 's' : ''})`}
              </button>
            </div>
          </>
        )}

        <h2 style={{ marginTop: 32 }}>Historique des lots</h2>
        {lots.length === 0 ? (
          <p className="ligne-vide">Aucun lot créé pour l'instant sur ce niveau.</p>
        ) : (
          <table className="tableau-liste">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Statut</th>
                <th>Terme</th>
                <th>Cours</th>
                <th>Ouvert le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td>Lot {lot.numero}</td>
                  <td>
                    <span className={`badge-etat ${lot.statut === 'OUVERT' ? 'badge-valide' : 'badge-echoue'}`}>
                      {lot.statut === 'OUVERT' ? 'Ouvert' : 'Fermé'}
                    </span>
                  </td>
                  <td>
                    {lot.terme === 'AUTOMNE' ? 'Automne' : lot.terme === 'PRINTEMPS' ? 'Printemps' : lot.terme === 'ETE' ? 'Été' : '—'}
                  </td>
                  <td>{lot.cours.map((c) => `${c.cours.titre} (${c.cours.code})`).join(', ')}</td>
                  <td>{new Date(lot.dateOuverture).toLocaleDateString('fr-FR')}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    {lot.statut === 'OUVERT' && (
                      <>
                        <button
                          className="bouton-secondaire"
                          onClick={() => setLotEnEdition(lotEnEdition === lot.id ? null : lot.id)}
                        >
                          {lotEnEdition === lot.id ? 'Fermer l\'édition' : 'Modifier les cours'}
                        </button>
                        <button
                          className="bouton-secondaire"
                          onClick={() => gererFermetureLot(lot.id)}
                          disabled={actionEnCours === `fermer-${lot.id}`}
                        >
                          {actionEnCours === `fermer-${lot.id}` ? 'Fermeture...' : 'Fermer'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {lots
                .filter((lot) => lotEnEdition === lot.id)
                .map((lot) => {
                  const coursDejaDansLot = new Set(lot.cours.map((c) => c.coursId));
                  const coursDisponiblesAAjouter = statistiques.filter((s) => !coursDejaDansLot.has(s.coursId));
                  return (
                    <tr key={`edition-${lot.id}`}>
                      <td colSpan={6} style={{ background: 'var(--couleur-fond)', padding: 16 }}>
                        <p className="panneau-sous-titre" style={{ marginTop: 0 }}>
                          Retirer un cours n'est bloqué que si un étudiant y a déjà une note saisie. Sinon, ses
                          affectations depuis ce lot sont défaites et son souhait redevient en attente.
                          Ajouter un cours convertit tout de suite les souhaits déjà exprimés dessus, exactement
                          comme à la création du lot.
                        </p>

                        <strong>Cours actuellement dans ce lot</strong>
                        {lot.cours.length === 0 ? (
                          <p className="ligne-vide">Aucun cours dans ce lot.</p>
                        ) : (
                          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
                            {lot.cours.map((c) => (
                              <li
                                key={c.coursId}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}
                              >
                                <span>{c.cours.titre} ({c.cours.code})</span>
                                <button
                                  className="bouton-secondaire"
                                  style={{ padding: '2px 10px', fontSize: 12 }}
                                  onClick={() => gererRetraitCoursDuLot(lot.id, c.coursId)}
                                  disabled={actionEnCours === `retirer-${lot.id}-${c.coursId}`}
                                >
                                  {actionEnCours === `retirer-${lot.id}-${c.coursId}` ? '...' : 'Retirer'}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <strong>Ajouter un cours</strong>
                        {coursDisponiblesAAjouter.length === 0 ? (
                          <p className="ligne-vide">
                            Aucun autre cours avec des souhaits exprimés sur ce niveau, disponible à ajouter.
                          </p>
                        ) : (
                          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
                            {coursDisponiblesAAjouter.map((s) => (
                              <li
                                key={s.coursId}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}
                              >
                                <span>{s.titre} ({s.code}), {s.nombreSouhaits} souhait(s)</span>
                                <button
                                  className="bouton-secondaire"
                                  style={{ padding: '2px 10px', fontSize: 12 }}
                                  onClick={() => gererAjoutCoursAuLot(lot.id, s.coursId)}
                                  disabled={actionEnCours === `ajouter-${lot.id}-${s.coursId}`}
                                >
                                  {actionEnCours === `ajouter-${lot.id}-${s.coursId}` ? '...' : 'Ajouter'}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}

        <h2 style={{ marginTop: 32 }}>Par étudiant</h2>
        {classe?.inscriptions
          .filter((i) => i.statutInscription === 'ACTIVE' && i.etudiant.statut !== 'BLOQUE')
          .map((inscription) => {
            const etat = etats.get(inscription.id);
            if (!etat) return null;

            const assignables = [...etat.echouesDefinitivement, ...etat.eligiblesNouveaux];
            const selectionActuelle = selections.get(inscription.id) ?? new Set<string>();
            const minimumRequis = Math.min(2, assignables.length);
            const nombreVerrouilles = etat.horsDePortee.length + etat.finDeCycleVerrouille.length;
            const cleLot = `lot-${inscription.id}`;

            return (
              <div key={inscription.id} className="carte-etudiant">
                <h3>{inscription.etudiant.matricule} · {inscription.etudiant.nom}</h3>

                <div className="ligne-badges">
                  {etat.valides.length > 0 && (
                    <span className="badge-etat badge-valide">✓ {etat.valides.length} validé{etat.valides.length > 1 ? 's' : ''}</span>
                  )}
                  {etat.enAttente.map((c) => (
                    <span key={c.id} className="badge-etat badge-en-attente">En cours : {c.code}</span>
                  ))}
                </div>

                {etat.souhaites.length > 0 && (
                  <>
                    <p className="section-titre">Souhaits en attente d'ouverture</p>
                    <div className="ligne-badges" style={{ marginBottom: 12 }}>
                      {etat.souhaites.map((c) => (
                        <span key={c.id} className="badge-etat badge-souhaite">
                          {c.titre} ({c.code})
                          <button
                            className="bouton-retirer-souhait"
                            onClick={() => gererRetraitSouhait(inscription.id, c.id)}
                            disabled={actionEnCours === `retrait-${inscription.id}-${c.id}`}
                            title="Retirer ce souhait"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {assignables.length === 0 ? (
                  <p className="ligne-vide">Aucun nouveau cours à souhaiter pour cet étudiant en ce moment.</p>
                ) : (
                  <>
                    <p className="section-titre">
                      Composer un nouveau lot ({minimumRequis === TAILLE_LOT_MAX ? TAILLE_LOT_MAX : `${minimumRequis} à ${TAILLE_LOT_MAX}`} cours)
                    </p>
                    {assignables.map((cours) => {
                      const estAReprendre = etat.echouesDefinitivement.some((e) => e.id === cours.id);
                      return (
                        <div key={cours.id} className="ligne-cours-actionnable">
                          <label className="case-souhait">
                            <input
                              type="checkbox"
                              checked={selectionActuelle.has(cours.id)}
                              disabled={actionEnCours === cleLot}
                              onChange={() => basculerSelection(inscription.id, cours.id)}
                            />
                            {cours.titre} ({cours.code})
                            {estAReprendre && <span className="etiquette-a-reprendre">à reprendre</span>}
                          </label>
                        </div>
                      );
                    })}
                    <button
                      className="bouton-principal"
                      style={{ marginTop: 12 }}
                      onClick={() => gererSoumissionLot(inscription.id, minimumRequis)}
                      disabled={actionEnCours === cleLot || selectionActuelle.size === 0}
                    >
                      {actionEnCours === cleLot
                        ? 'Soumission...'
                        : `Soumettre comme souhait (${selectionActuelle.size} sélectionné${selectionActuelle.size > 1 ? 's' : ''})`}
                    </button>
                  </>
                )}

                {nombreVerrouilles > 0 && (
                  <details className="section-verrouillee">
                    <summary>{nombreVerrouilles} cours verrouillé{nombreVerrouilles > 1 ? 's' : ''}</summary>
                    {etat.horsDePortee.map((cours) => (
                      <div key={cours.id} className="ligne-verrouillee">
                        <span>{cours.titre} ({cours.code})</span>
                        <span className="raison">
                          {cours.prerequisManquant
                            ? `nécessite ${cours.prerequisManquant.titre} (${cours.prerequisManquant.code})`
                            : 'prérequis non validé'}
                        </span>
                        <button
                          className="bouton-secondaire"
                          onClick={() => gererDeblocage(inscription.id, cours.id)}
                          disabled={actionEnCours === `debloquer-${inscription.id}-${cours.id}`}
                        >
                          Débloquer
                        </button>
                      </div>
                    ))}
                    {etat.finDeCycleVerrouille.map((cours) => (
                      <div key={cours.id} className="ligne-verrouillee">
                        <span>{cours.titre} ({cours.code})</span>
                        <span className="raison">disponible une fois tout le reste du cycle validé</span>
                        <button
                          className="bouton-secondaire"
                          onClick={() => gererDeblocage(inscription.id, cours.id)}
                          disabled={actionEnCours === `debloquer-${inscription.id}-${cours.id}`}
                        >
                          Débloquer
                        </button>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
