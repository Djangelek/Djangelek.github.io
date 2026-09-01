---
name: Colombia Navega
description: "El Manifiesto — bitácora náutica sobre papel de manifiesto e tinta índigo para controlar la flota en vivo."
colors:
  papel: "#f6f3ea"
  papel-alto: "#fbf9f1"
  papel-hondo: "#ece6d4"
  tinta: "#1c2b4a"
  tinta-suave: "#4a5874"
  tinta-tenue: "#5f6c88"
  sello: "#c8452c"
  etiqueta: "#0e7c7b"
  mar: "#2e6f9e"
  puerto: "#2f7d4f"
  ambar: "#7c4f0b"
  linea: "rgba(28, 43, 74, 0.16)"
  linea-fuerte: "rgba(28, 43, 74, 0.38)"
  ok-fondo: "#e3efdf"
  ok-texto: "#1f5c3d"
  err-fondo: "#f8e2db"
  err-texto: "#8c2f1d"
  info-fondo: "#dfe9f2"
  info-texto: "#1f4e72"
  aviso-fondo: "#f6ead2"
  aviso-texto: "#7a4b0e"
  foco: "#0e7c7b"
typography:
  display:
    fontFamily: "'Archivo Black', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 400
    letterSpacing: "0.01em"
  title:
    fontFamily: "'Archivo Black', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
  body:
    fontFamily: "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 800
    letterSpacing: "0.07em"
  data:
    fontFamily: "ui-monospace, 'Cascadia Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace"
    fontWeight: 800
    fontFeature: "'tnum' 1"
rounded:
  radio: "14px"
  radio-mini: "10px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel-alto}"
    rounded: "{rounded.radio}"
    padding: "14px 22px"
    height: "56px"
  button-danger:
    backgroundColor: "{colors.sello}"
    textColor: "#ffffff"
    rounded: "{rounded.radio}"
    padding: "14px 22px"
    height: "56px"
  button-success:
    backgroundColor: "{colors.puerto}"
    textColor: "#ffffff"
    rounded: "{rounded.radio}"
    padding: "14px 22px"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.papel-alto}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.radio-mini}"
    padding: "10px 18px"
    height: "48px"
  input:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.radio-mini}"
    height: "48px"
  chip:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.radio-mini}"
    height: "56px"
  card:
    backgroundColor: "{colors.papel-alto}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.radio}"
    padding: "18px 16px"
  tag:
    backgroundColor: "{colors.papel-alto}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pill}"
---

# Design System: Colombia Navega · El Manifiesto

## Overview

**Creative North Star: "El Manifiesto"**

La interfaz entera se trata como el **manifiesto de embarque** de una flota náutica: un papel de manifiesto tibio que cada barco debe llenar y sellar cada mañana. No hay tarjetas SaaS; hay **hojas** de papel (#f6f3ea) escritas con **tinta índigo** (#1c2b4a) y selladas con un **sello rojo** (#c8452c). Cada dato es una entrada del libro del día, en monoespaciado tabular, y cada quiebre de sección es el borde **perforado de talonario** (raya discontinua de 2px). Se rechaza explícitamente el dashboard genérico de sidebar y tarjetas: el mundo visual es un cuaderno de a bordo.

La tinta índigo es la voz (texto y botón primario); el papel tibio es siempre el suelo; el sello rojo y las etiquetas de estado son los únicos acentos que entran en color. El tema nocturno **"tinta"** invierte el papel por tinta y la tinta por papel, para mar abierto de noche. Los datos viven en `font-variant-numeric: tabular-nums` para que columnas de cifras alineen como un libro de cuentas.

**Key Characteristics:**

- Mundo de papel de manifiesto, no dashboard SaaS de tarjetas.
- Tinta índigo sobre papel tibio; sello rojo como único acento fuerte.
- Perforado de talonario (raya discontinua de 2px) como divisor de secciones.
- Monoespaciado tabular para todo dato numérico/horario; etiquetas en mayúsculas.
- Dos temas: `papel` (día, sol caribeño) y `tinta` (noche, invertido).
- Móvil de tripulación: una acción por pantalla y barra de envío fija; escritorio de supervisión: mostrador de tres zonas.

## Colors

La paleta es **papel e tinta** con un sello rojo y etiquetas de estado por color; todo color sólido es bajo en saturación y pensado para leerse bajo sol caribeño.

### Primary

- **Tinta índigo** (#1c2b4a): la tinta. Texto por defecto, botón primario (`.btn-stamp`), pestaña activa y superficie "rellena". Es el color de marca que se lee en todas partes.

### Secondary

- **Etiqueta teal** (#0e7c7b): el acento interactivo. Enlaces (`.btn-link`), color de selección, checkboxes/radios (`accent-color`), foco (`--foco`), valor de combustible, horas de bitácora y botones demo. Es el color de "esto responde".

### Tertiary

- **Sello rojo** (#c8452c): el sello. Alertas, botones de peligro (`.btn-stamp.peligro`, `.btn-mini.danger`), estados de error y el sello "Pendiente". Su rareza es el punto: aparece cuando algo exige atención o se sella.

### Neutral

- **Papel** (#f6f3ea): fondo de página y de inputs; el suelo tibio del sistema.
- **Papel alto** (#fbf9f1): superficies elevadas — hojas, cabeceras, tarjetas, barra de envío.
- **Papel hondo** (#ece6d4): papel hundido — hover de chips/botones, fondo del mapa, esqueleto de carga.
- **Tinta suave** (#4a5874): texto secundario y labels.
- **Tinta tenue** (#5f6c88): texto terciario/atenuado (`.muted`, placeholders).
- **Línea** (rgba(28,43,74,0.16)): bordes y separadores suaves.
- **Línea fuerte** (rgba(28,43,74,0.38)): bordes de inputs, perforado, doble regla.

### Estado / Señal

- **Mar** (#2e6f9e): info / GPS obteniendo posición / rol capitán / filtro demo.
- **Puerto** (#2f7d4f): éxito / rol operación / exportar / `.sello.ok` / botón de éxito.
- **Ámbar** (#7c4f0b): aviso / rol ventas / estado "recogida de pasajeros" / `.sello.alerta`. Oscurecido respecto al ámbar decorativo para cumplir AA (≥4.5:1) como color de texto sobre papel; en el tema `tinta` se usa #e8b04c.
- Pares de fondo/texto para los cuatro tonos de mensaje: `--ok-*` (verde), `--err-*` (rojo), `--info-*` (azul), `--aviso-*` (ámbar), aplicados a toasts, status y chips GPS.

### Tema nocturno "tinta"

`[data-theme='tinta']` re-mapea los mismos tokens: papel→#131c2e, papel-alto→#1b2740, papel-hondo→#0e1626; la tinta se vuelve papel claro (#f2eddf) y los acentos se aclaran (sello→#ef6a4c, etiqueta→#4fc3c0, mar→#6fb1e8, puerto→#6fce94, ámbar→#e8b04c). Las sombras pasan de tinta a negro profundo. **Siempre** se referencia `var(--…)`; nunca se hardcodea un valor de un solo tema.

### Named Rules

**The Paper-Ground Rule.** Todo se asienta sobre `papel` / `papel-alto` / `papel-hondo`. No existe blanco puro ni negro puro en ninguna superficie; el papel siempre tiene tibieza.

**The Stamp Rarity Rule.** El sello rojo (#c8452c) solo entra como sello, alerta o acción destructiva. Nunca inunda una superficie; su escasez es el mensaje.

## Typography

**Display/UI Font:** 'Archivo Black' (autoalojada, woff2 en `app/public/fonts/`) para marca, `h1`/`h2`, `.hoja-titulo`, `.btn-stamp` y `.sello` — la tinta del sello.
**Body Font:** 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif
**Label/Data (Mono):** ui-monospace, 'Cascadia Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace

**Character:** una sans de sistema nítida y operativa para la lectura rápida, coronada por la voz display **Archivo Black** (peso único 400, nunca sintetizado a bold) que estampa títulos, sellos y botones primarios; el monoespaciado tabular contabiliza los datos.

### Hierarchy

- **Display** (Archivo Black 400, 1.2rem): títulos de página y sección (`h1`, `h2`, `.hoja-titulo`).
- **Title** (Archivo Black 400, 0.95rem en `.hoja-titulo`; sans 800 para `h3`).
- **Body** (400, 1rem / 0.9rem en filas): contenido; etiquetas de dato y listas bajan a 0.85–0.9rem.
- **Label** (800, 0.78rem, letter-spacing 0.07em, MAYÚSCULAS): labels de campo (`.campo label`), rótulos (`.rotulo`), cabeceras de tabla, `.stat span`.
- **Data** (800, mono, tabular-nums): números, horas, coordenadas, contadores (`.dato`, `.stat b`, `.hora`, `.boat-info b`, `.history-table td.num`).

### Named Rules

**The Tabular Ledger Rule.** Todo número, hora, coordenada o conteo se renderiza en la pila mono con `tabular-nums`, para que las columnas alineen como un libro de cuentas.

**The Uppercase Label Rule.** Labels, títulos de sección y botones van en mayúsculas con letter-spacing (0.05–0.08em). Nunca en estilo oración para el cromado.

## Layout

La app vive en `.app`, centrada con `max-width: 1720px` y padding fluido `clamp(12px, 2vw, 28px)`. El ritmo espacial es una cuadrícula de 4px: gaps y paddings recurrentes de 8 / 10 / 12 / 14 / 16 / 20px.

- **Móvil — Operate (tripulación):** una columna; `.report-page` se acota a `max-width: 620px` centrada. Una acción por pantalla. La `.barra-enviar` queda fija abajo con `env(safe-area-inset-bottom)` y espacio de `padding-bottom: 92px` reservado.
- **Escritorio — Operate (supervisores):** `.dashboard-grid` es el **mostrador de tres zonas** a partir de `1100px`: flota `330px` | mapa `minmax(0,1fr)` | bitácoras del día `340px`. El mapa es sticky (`height: calc(100vh - 240px)`); las columnas laterales scrollean independientes. Bajo `1100px` todo se apila en una columna.
- **Breakpoints observados:** `640px` (apilado de grids 2/3 y compactado de header), `900px` (chips de estado a 3 columnas), `1000px` (admin a 2 columnas), `1100px` (dashboard a 3 zonas).
- **Admin:** `.admin-grid` a 2 columnas desde `1000px`; secciones de ancho completo usan `grid-column: 1 / -1`.

## Elevation & Depth

Sistema **híbrido**: la profundidad se construye sobre todo por **capas tonales** (papel → papel-alto → papel-hondo) y se refuerza con sombras suaves y ambientales. No hay sombras duras ni elevación estructural de Material.

### Shadow Vocabulary

- **Sombra** (`0 1px 2px rgba(28,43,74,0.08), 0 10px 26px rgba(28,43,74,0.10)`): hojas, tarjetas, header, hover de filas.
- **Sombra alta** (`0 2px 6px rgba(28,43,74,0.12), 0 18px 44px rgba(28,43,74,0.18)`): login, popups Leaflet, toasts.
- **Barra de envío** (`0 -8px 24px rgba(28,43,74,0.14)`): sombra hacia arriba de la barra fija.
- **Botón sello** (`0 2px 4px rgba(28,43,74,0.18)`, hover `0 4px 10px rgba(28,43,74,0.25)`): la "presión" del sello al levantarse.

### Named Rules

**The Flat-by-Default Rule.** Las superficies están planas en reposo. La sombra aparece solo como respuesta a un estado (hover que levanta 1px, foco, popup flotante). Ninguna hoja lleva sombra decorativa permanente.

## Shapes

El lenguaje de forma es **papel redondeado**: esquinas generosas y sin ángulos vivos. Escala de radio: `14px` (`--radio`) para hojas/tarjetas/alertas, `10px` (`--radio-mini`) para inputs/chips/filas, y `999px` (píldora) para etiquetas, badges, toggles y chips GPS. El sello usa un radio propio y apretado (6px) con borde grueso (2.5px) y una rotación fija de −3°.

- **Perforado de talonario:** el divisor firma es la raya discontinua de 2px (`border` dashed sobre `--linea-fuerte`), usada como borde inferior de `.hoja-titulo` y como `.perforado` entre secciones.
- **Doble regla:** `border-bottom: 3px double` firma la "pila de hojas" en header, `.stat` y login-card.
- Todo es redondeado; no hay esquinas en ángulo recto en ningún componente de la hoja.

## Components

Cada componente se lee como parte del manifiesto: papel, tinta y sello. Los estados se distinguen por tono (fondo/color) más que por geometría.

### Buttons

- **Shape:** radio `14px` (sello) o `10px` (secundario/mini); el primario es el sello.
- **Primary (`.btn-stamp`):** fondo tinta, texto papel-alto, Archivo Black 400, mayúsculas, letter-spacing 0.06em, `min-height: 56px`, `padding: 14px 22px`, con icono SVG a la izquierda. Es el sello que se presiona.
- **Hover / Focus:** hover levanta 1px y amplía sombra (transform + box-shadow 140ms); active vuelve a 0. Disabled a 45% de opacidad.
- **Variantes:** `.exito` (fondo puerto, texto #fff) para "IR A REPORTAR"; `.peligro` (fondo sello, texto #fff) para acciones destructivas.
- **Secondary (`.btn-secundario`):** fondo papel-alto, borde 1.5px línea-fuerte, radio 10px, `min-height: 48px`; hover tiñe el borde de etiqueta.
- **Mini (`.btn-mini`):** `min-height: 44px`, radio 10px; `.danger` cambia a fondo err/rojo y al hover se rellena de sello.
- **Export (`.btn-export`):** borde 2px puerto, fondo ok, texto ok — la acción de exportación en verde.
- **Toggle (`.btn-toggle`):** píldora; `.on` verde, `.demo` azul.
- **Demo (`.btn-demo`):** borde etiqueta, fondo etiqueta al 10%, hover rellena etiqueta con texto #fff.

### Chips

- **`.chip-estado` (selector de estado):** fondo papel, borde 1.5px línea-fuerte, radio 10px, `min-height: 56px`, con `.estado-dot` de color. Seleccionado (`.sel`): borde 2px del color del estado, fondo papel-hondo, levanta 1px.
- **`.estado-tag` (etiqueta de fila):** píldora con `estado-dot` + nombre, borde y texto del color del estado.
- **`.estado-dot`:** punto de color de 11px (14px dentro de chip) con borde sutil de tinta al 25%; es el único canal por el que el color de estado entra a la UI.
- **`.gps-chip`:** píldora verde (`.err` rojo) para el estado de la capa GPS en vivo.

### Cards / Containers

- **Corner Style:** radio 14px (`--radio`).
- **Background:** papel-alto (hoja/cabecera), papel (fila/input/lista).
- **Shadow Strategy:** `--sombra` (hoja) / `--sombra-alta` (login, popup).
- **Border:** 1px `--linea`; el título de hoja cierra con perforado 2px dashed.
- **Internal Padding:** 18px 16px (hoja), 16px (cabecera), 12px 14px (stat).

### Inputs / Fields

- **Style:** borde 1.5px `--linea-fuerte`, fondo papel, radio 10px, `min-height: 48px`, `padding: 12px 14px`.
- **Focus:** borde `--foco` (etiqueta) + anillo `0 0 0 3px color-mix(foco 25%)`; `:focus-visible` global usa outline 3px sólido `--foco` con offset 2px.
- **Select:** `appearance: none` con chevron dibujado en CSS; `input[type=color]` se acota a 58px; checkbox/radio y `range` usan `accent-color: var(--etiqueta)`.
- **Error / Disabled:** errores se comunican por mensaje `.status-error-msg` (fondo err, borde sello), no por borde de input roto.

### Navigation

- **Header (`.site-header`):** portada del cuaderno — fondo papel-alto, borde 1px línea, cierre con doble regla 3px. Marca (logo + "Colombia Navega" / tag "Manifiesto de flota") a la izquierda, pestañas al centro, usuario/rol/tema a la derecha.
- **Pestañas (`.nav-tabs` / `.tab-btn`):** contenedor píldora; tab activo rellena tinta con texto papel-alto; hover papel-hondo. `min-height: 44px` táctil.
- **Rol (`.badge-rol`):** píldora con borde `currentColor` y fondo `color-mix(rol 12%)` — capitán=mar, marinero=etiqueta, operación=puerto, ventas=ámbar.

### Iconografía

Sistema de iconos **SVG de trazo único** (2px, puntas redondas, `stroke: currentColor`) en `app/src/components/ui/Iconos.tsx`: `bitacora`, `reportar`, `editar`, `mapa`, `historial`, `admin`, `ancla`, `barco`, `brujula`, `personas`, `campana`, `altavoz`, `antena`, `papelera`, `ubicacion`, `sol`, `luna`, `alerta`, `sello`, `diana`, `descargar`. Los emojis/glifos Unicode están **prohibidos** como iconografía (craft floor); el único caso especial es el ancla SVG embebida dentro de los marcadores Leaflet (`.gps-marker`, vía `svgAnclaBlanco`). Tamaños: 16–20px en controles, 36px en `.gate`, 14px en sellos y líneas de GPS.

### Sello (firma)

**`.sello`** es la firma visual del sistema: borde 2.5px del color (sello por defecto, `.ok` verde, `.alerta` ámbar), radio 6px, mayúsculas con letter-spacing 0.1em y una **rotación fija de −3°** que lo hace parecer estampado a mano. `.sello-cae` dispara la animación `sello-cae` (240ms `cubic-bezier(0.16,1,0.3,1)`): cae de `scale(1.45)` con opacidad 0 hasta aterrizar en su rotación.

### Gate (bitácora pendiente)

**`.gate`** bloquea la acción cuando falta la Check Bitácora: borde 2px dashed, fondo papel-alto, texto centrado con icono SVG (brujula/bitacora, 36px, color sello) y un único `.btn-stamp` de hasta 340px. Es el "papel en blanco que espera sello".

### Barra de envío

**`.barra-enviar`** es la acción única móvil: fija abajo, fondo papel-alto, borde superior perforado (2px dashed), sombra hacia arriba y `safe-area-inset-bottom`; contiene un único `.btn-stamp` acotado a 620px.

### Fila de manifiesto (`.boat-row`)

Tarjeta de barco clicable: fondo papel-alto, radio 10px, borde 1px línea; hover levanta 1px y aplica `--sombra`. Contiene `.boat-title` (800), `.estado-tag` con el estado, `.boat-place` (icono ubicacion + lugar), `.boat-info` con cifras en mono (PAX/maletas/bolsos) y `.boat-time` en mono atenuado.

### Esqueleto (carga)

**`.esqueleto`** es un shimmer de papel: gradiente lineal papel-hondo→papel-alto→papel-hondo animado (`esqueleto-brilla` 1.4s), radio 10px, `min-height: 56px`.

### Mapa y GPS

Mapa Leaflet en `.mapa-wrap` (radio 14px, fondo papel-hondo). Marcadores `.fleet-dot .dot` (14px, borde 2.5px papel-alto) para reportes y `.gps-marker` (26px, borde blanco 2px) para GPS en vivo; `.gps-marker.moviendo` pulsa en verde (`gps-pulse` 1.6s). Popups heredan papel-alto/tinta con `--sombra-alta`.

### Tablas (Historial)

`.history-table` con `border-collapse`, filas separadas por 1px `--linea`, cabeceras en label (mayúsculas 0.7rem 0.06em), celdas numéricas en mono tabular.

## Do's and Don'ts

### Do:

- **Do** asentar toda superficie sobre el trío papel / papel-alto / papel-hondo; nunca blanco puro ni negro puro.
- **Do** renderizar cifras, horas y coordenadas en mono con `tabular-nums` (la Regla del Libro de Cuentas).
- **Do** usar el perforado de 2px dashed (`--linea-fuerte`) para dividir secciones de una hoja, no reglas sólidas.
- **Do** poner labels, títulos de sección y botones en MAYÚSCULAS con letter-spacing (0.05–0.08em).
- **Do** referenciar solo `var(--…)` para que los temas `papel` y `tinta` resuelvan solos; nunca hardcodear un valor de un tema.
- **Do** acotar la experiencia móvil a `.report-page` (620px) con una sola `.btn-stamp` en `.barra-enviar` fija.
- **Do** marcar cada estado de barco con `.estado-dot` del color administrado por operaciones.
- **Do** usar exclusivamente los iconos SVG del sistema (trazo 2px, currentColor) vía `Icono` de `ui/Iconos.tsx`; los emojis están prohibidos como iconografía.
- **Do** respetar el objetivo táctil mínimo de 44px en todo control interactivo (incluidos `.btn-delete` y `.btn-link`).

### Don't:

- **Don't** introducir tarjetas SaaS de borde duro ni sidebar genérico; el mundo es papel de manifiesto.
- **Don't** usar el sello rojo (#c8452c) como acento genérico; está reservado a sello, alerta y destrucción.
- **Don't** agregar un color de estado fuera del sistema administrado; los estados entran por `.estado-dot` con su propio color.
- **Don't** setear datos numéricos en la pila sans; deben ser mono tabular.
- **Don't** reemplazar el perforado dashed por bordes sólidos en los divisores de hoja/título.
- **Don't** usar emojis o glifos Unicode como iconografía ni colorear el ámbar por debajo de AA sobre papel.
- **Don't** usar sombras permanentes decorativas; la elevación es por capas tonales y la sombra responde al estado.
