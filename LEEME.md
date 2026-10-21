# Lotería de la Milpa Maya

Sitio estático (carpeta `docs/`) que usa Firebase Realtime Database como tiempo real.

## Puesta en marcha (una sola vez)
1. **Reglas de seguridad:** Firebase Console → Realtime Database → pestaña *Reglas* → pega el contenido de
   `database.rules.json` → *Publicar*. Sin esto el juego no funciona (o queda abierto a todo el mundo).
2. **Authentication → Método de acceso → Anónimo** debe estar habilitado.
3. **Dominio autorizado:** Authentication → Configuración → Dominios autorizados → agrega `TUUSUARIO.github.io`.
4. **GitHub Pages:** sube el proyecto a un repositorio → Settings → Pages → *Deploy from a branch* → `main` y carpeta `/docs`.

## Cómo se juega
El anfitrión abre el sitio → *Crear partida* y deja esa pestaña abierta (ahí corren el cantor automático y la
validación). Los jugadores entran con el QR o el código. Si el anfitrión recarga, recupera su sala.

## Agregar cartas
Añade la fila al Excel `cartas/lista_cartas.xlsx` (Número, Maya, Español, Pista), pon el PNG en `cartas/`
(`carta_NN_NOMBRE.png`) y ejecuta `python tools/build_cartas.py` (requiere `openpyxl` y `Pillow`). Sube los cambios de `docs/`.

## Probar en local
`python -m http.server 8000 --directory docs` y abre http://localhost:8000
