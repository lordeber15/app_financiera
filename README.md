# Mis Gastos — Notificaciones Financieras

Web app personal para registrar gastos por categoría, con presupuestos mensuales
y notificaciones a un **webhook de n8n** configurable desde la propia app. La
app solo hace `POST` de un evento JSON; es n8n quien decide qué hacer con él
(Telegram, WhatsApp, email, Slack, lo que sea).

## Estructura

```
backend/    API FastAPI + SQLite + Alembic + APScheduler
frontend/   React + Vite + TypeScript + Tailwind
```

## Puesta en marcha (desarrollo)

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # edita APP_PASSWORD y JWT_SECRET
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Genera un `JWT_SECRET` fuerte con:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Para usar un hash en vez de contraseña en texto plano:
```bash
python scripts/hash_password.py "mi-contraseña"
# copia el resultado en .env como APP_PASSWORD_HASH y borra APP_PASSWORD
```

Correr los tests:
```bash
pytest
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Abre `http://localhost:5173`. En dev, Vite reenvía `/api/*` al backend en el
puerto 8000 (ver `vite.config.ts`), así que la cookie de sesión funciona sin
configurar CORS entre puertos.

Contraseña por defecto (`.env.example`): `admin`.

## Producción con Docker

```bash
cp backend/.env.example backend/.env   # o exporta APP_PASSWORD/JWT_SECRET como variables
docker compose up -d --build
```

La app queda en `http://localhost` (nginx sirve el frontend y reenvía `/api`
al backend). Ajusta `APP_PASSWORD`/`JWT_SECRET` como variables de entorno
antes de levantar en un servidor real, y pon `COOKIE_SECURE=true` si sirves
por HTTPS.

## Configurar el workflow en n8n

1. En n8n, crea un workflow nuevo y agrega un nodo **Webhook**:
   - **HTTP Method:** `POST`
   - **Authentication:** `Header Auth` (crea una credencial con el nombre y
     valor que quieras, ej. header `X-Webhook-Token` = un secreto largo)
   - **Respond:** `Immediately` (para que la app no espere a que termine el flujo)
2. Copia la **Test URL** del nodo, actívala con "Listen for test event", y
   pégala en la app: **Configuración → Webhook de n8n**. Pon el mismo nombre y
   valor de header que configuraste en n8n. Pulsa **Probar webhook** — debe
   llegar un evento `test` al nodo Webhook de n8n.
3. Después del nodo Webhook, agrega un nodo **Switch** que rame por
   `{{$json.event}}` (`expense.created`, `budget.threshold`, `summary.daily`,
   `summary.weekly`, `test`) y conecta cada rama al nodo que quieras
   (Telegram, Email, WhatsApp Business, Slack, etc.), usando los campos de
   `{{$json.data}}` para armar el mensaje.
4. Cuando esté listo, **publica** el workflow y cambia la URL en la app por la
   **URL de producción** del nodo Webhook.

### Contrato del payload

Todos los eventos llegan con el mismo sobre:

```json
{
  "event": "expense.created | budget.threshold | summary.daily | summary.weekly | test",
  "sent_at": "2026-09-19T21:50:39.226241-05:00",
  "currency": "PEN",
  "data": { "...": "depende del evento" }
}
```

- **`expense.created`** — `data`: `id, amount_cents, category:{id,name},
  description, spent_at, category_month_total_cents, category_budget_cents,
  category_pct`
- **`budget.threshold`** — `data`: `category:{id,name}, period, threshold_pct
  (80|100|...), spent_cents, budget_cents`. Se envía una sola vez por
  categoría/mes/umbral.
- **`summary.daily`** / **`summary.weekly`** — `data`: `period_start,
  period_end, total_cents, by_category:[{category_id,name,total_cents,
  budget_cents,pct}], top_expenses:[{id,amount_cents,description,spent_at,
  category_id}]`
- **`test`** — `data`: `{ "message": "..." }`

## Eventos y su origen

| Evento | Cuándo se dispara |
|---|---|
| `expense.created` | Al registrar un gasto (si "Notificar cada gasto" está activo) |
| `budget.threshold` | Al cruzar 80% o 100% (configurable) del presupuesto mensual de una categoría |
| `summary.daily` | A la hora configurada, cada día (si está habilitado) |
| `summary.weekly` | El día y hora configurados, cada semana (si está habilitado) |
| `test` | Al pulsar "Probar webhook" en Configuración |

Todo envío (éxito o error) queda en el **historial de webhook** de
Configuración, con botón para **reenviar** los que fallaron.

## Alcance de este MVP

Dentro: registro rápido de gastos, categorías con presupuesto, alertas de
umbral, resúmenes periódicos, webhook configurable, un solo usuario protegido
por contraseña.

Fuera (fase 2+): multiusuario, sincronización bancaria, ingresos,
multi-moneda, OCR de recibos, exportar CSV, app nativa.
