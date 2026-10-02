import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { listerAnneesUniversitaires } from '../services/referentiel.service';
import type { AnneeUniversitaire } from '../types/classes.types';

const CLE_STOCKAGE = 'isb-annee-selectionnee-id';

interface AnneeUniversitaireContextValue {
  annees: AnneeUniversitaire[];
  anneeSelectionneeId: string | null;
  setAnneeSelectionneeId: (id: string) => void;
  enChargement: boolean;
  rafraichirAnnees: () => Promise<void>;
}

const AnneeUniversitaireContext = createContext<AnneeUniversitaireContextValue | null>(null);

/**
 * Fournit l'année universitaire actuellement sélectionnée à toute
 * l'application — une seule sélection, mémorisée (localStorage) et valable
 * sur tous les écrans, pour ne plus jamais mélanger les classes de
 * plusieurs années dans une même liste.
 *
 * Par défaut : l'année marquée "active" en base, sinon la première
 * disponible. La sélection précédente (localStorage) est reprise au
 * rechargement, si elle correspond toujours à une année existante.
 */
export function AnneeUniversitaireProvider({ children }: { children: ReactNode }) {
  const [annees, setAnnees] = useState<AnneeUniversitaire[]>([]);
  const [anneeSelectionneeId, setAnneeSelectionneeIdState] = useState<string | null>(null);
  const [enChargement, setEnChargement] = useState(true);

  /**
   * Recharge la liste des années depuis le serveur — appelé au démarrage,
   * et à nouveau après la création d'une nouvelle année (par exemple depuis
   * l'en-tête), pour qu'elle apparaisse immédiatement dans le sélecteur
   * sans exiger un rechargement complet de la page.
   */
  async function rafraichirAnnees(): Promise<void> {
    const liste = await listerAnneesUniversitaires();
    setAnnees(liste);

    let idStocke: string | null = null;
    try {
      idStocke = localStorage.getItem(CLE_STOCKAGE);
    } catch {
      // localStorage indisponible (navigation privée, etc.) — on
      // retombe simplement sur le défaut, rien de bloquant.
    }

    const stockeEstValide = idStocke != null && liste.some((a) => a.id === idStocke);

    if (stockeEstValide) {
      setAnneeSelectionneeIdState(idStocke);
    } else {
      const anneeActive = liste.find((a) => a.estActive);
      setAnneeSelectionneeIdState(anneeActive?.id ?? liste[0]?.id ?? null);
    }
  }

  useEffect(() => {
    rafraichirAnnees().finally(() => setEnChargement(false));
  }, []);

  function setAnneeSelectionneeId(id: string) {
    setAnneeSelectionneeIdState(id);
    try {
      localStorage.setItem(CLE_STOCKAGE, id);
    } catch {
      // Rien de bloquant si le stockage échoue — la sélection reste active
      // pour la session en cours, juste pas mémorisée au rechargement.
    }
  }

  return (
    <AnneeUniversitaireContext.Provider
      value={{ annees, anneeSelectionneeId, setAnneeSelectionneeId, enChargement, rafraichirAnnees }}
    >
      {children}
    </AnneeUniversitaireContext.Provider>
  );
}

export function useAnneeUniversitaire(): AnneeUniversitaireContextValue {
  const contexte = useContext(AnneeUniversitaireContext);
  if (!contexte) {
    throw new Error("useAnneeUniversitaire doit être utilisé à l'intérieur d'un AnneeUniversitaireProvider.");
  }
  return contexte;
}
