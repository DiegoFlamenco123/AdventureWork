# Adventure Works API

API para la tienda de bicicletas Adventure Works con facturación electrónica para El Salvador.

## Configuración

1. Instalar dependencias:
```bash
npm install
```

2. Crear archivo `.env` con las siguientes variables:
```env
# JWT Secret for authentication
JWT_SECRET=your-super-secret-jwt-key-here

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id

# Email configuration for sending invoices
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Server configuration
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://yourdomain.com
```

3. Ejecutar el servidor:
```bash
npm run dev
```

## Endpoints

### Autenticación
- `POST /api/auth/signup` - Registro de usuario
- `POST /api/auth/signin` - Inicio de sesión
- `POST /api/auth/google` - Inicio de sesión con Google

### Productos
- `GET /api/products` - Lista de productos
- `GET /api/products/:id` - Detalle de producto
- `GET /api/categories` - Lista de categorías

### Órdenes
- `POST /api/orders` - Crear orden
- `GET /api/orders/:id` - Obtener orden
- `GET /api/orders/:id/invoice.pdf` - Descargar factura PDF
- `POST /api/orders/:id/send-invoice` - Enviar factura por email

## Facturación Electrónica

La API genera facturas electrónicas que cumplen con las normativas de El Salvador:

- Incluye información de la empresa (NIT, dirección, etc.)
- Calcula IVA del 13% según normativa salvadoreña
- Genera PDF con formato profesional
- Envía factura por email al cliente
- Cumple con requisitos del Ministerio de Hacienda

## Estructura de Datos

### Orden
```json
{
  "id": "string",
  "userId": "string",
  "items": [
    {
      "productId": "string",
      "name": "string",
      "brand": "string",
      "qty": "number",
      "unit": "number",
      "line": "number"
    }
  ],
  "address": {
    "name": "string",
    "email": "string",
    "line1": "string",
    "city": "string",
    "country": "string"
  },
  "total": "number",
  "status": "string",
  "createdAt": "number"
}
```





