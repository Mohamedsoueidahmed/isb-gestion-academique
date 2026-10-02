import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes';
import classesRoutes from './modules/classes/classes.routes';
import referentielRoutes from './modules/referentiel/referentiel.routes';
import etudiantsRoutes from './modules/etudiants/etudiants.routes';
import notesRoutes from './modules/notes/notes.routes';
import absencesRoutes from './modules/absences/absences.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import bulletinsRoutes from './modules/bulletins/bulletins.routes';
import electifsRoutes from './modules/electifs/electifs.routes';
import lotsRoutes from './modules/lots/lots.routes';
import dispensesRoutes from './modules/dispenses/dispenses.routes';
import integrationRoutes from './modules/integration/integration.routes';
import { gestionErreurs } from './shared/middlewares/gestionErreurs';

dotenv.config();

const app: Application = express();

app.use(cors());
app.use(express.json());

// --- Routes ---
// Chaque module ajoutera ses propres routes ici au fur et à mesure des sections.
app.use('/api/auth', authRoutes);
app.use('/api/referentiel', referentielRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/etudiants', etudiantsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/absences', absencesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bulletins', bulletinsRoutes);
app.use('/api/electifs', electifsRoutes);
app.use('/api/lots', lotsRoutes);
app.use('/api/dispenses', dispensesRoutes);
app.use('/api/integration', integrationRoutes);

app.get('/api/sante', (_req, res) => {
  res.status(200).json({ statut: 'ok', message: 'API opérationnelle.' });
});

// Le middleware de gestion d'erreurs doit toujours être enregistré en dernier.
app.use(gestionErreurs);

export default app;
