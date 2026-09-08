import { PORT, GROQ_MODEL } from './config.js';
import { app } from './server.js';
import { startAlertChecker } from './lib/alert-checker.js';

app.listen(PORT, () => {
  console.log(
    `[cryptobolt-server] listening on port ${PORT} (bring-your-own-key mode, model: ${GROQ_MODEL})`
  );
});

startAlertChecker();