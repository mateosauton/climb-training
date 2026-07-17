# Perfil del usuario

## Objetivo

Rediseñar la sección Perfil como un panel híbrido: un resumen útil del atleta en la parte superior y una edición ordenada por pestañas. El perfil debe permitir consultar rápidamente identidad, objetivo y estado de entrenamiento sin dificultar la actualización de datos.

## Dirección visual

Mantener el sistema visual actual de Climb Training y su configuración shadcn `radix-nova`, con Geist, paleta neutral, tokens de tema y soporte claro/oscuro. La interfaz usará una densidad cómoda y componentes shadcn existentes: `Avatar`, `Badge`, `Card`, `Progress`, `Tabs`, `Input`, `Select`, `Button`, `Alert` y `AlertDialog`.

No se incorporarán gradientes, glassmorphism, colores arbitrarios ni tarjetas anidadas. Los iconos serán Lucide de 16 o 20 píxeles.

## Estructura

### Cabecera

La cabecera mostrará:

- Foto de perfil.
- Nombre.
- Edad y ubicación en una línea secundaria, por ejemplo `28 años · Salta`. Cada dato ausente se omite sin mostrar placeholders.
- Grado actual y grado objetivo.
- Estado del plan mediante un `Badge`.
- Foco técnico actual.
- Acción `Editar perfil`, que desplaza el foco a la zona de edición.

### Métricas

Debajo de la cabecera habrá cuatro tarjetas:

- **Racha:** semanas consecutivas con al menos una sesión registrada.
- **Esta semana:** sesiones completadas durante la semana calendario actual.
- **Carga:** baja, moderada o alta, derivada de sesiones, volumen y esfuerzo registrados.
- **Progreso:** avance estimado entre grado actual y objetivo. Solo se muestra un porcentaje si ambos grados pueden normalizarse y compararse. En caso contrario, se muestra el progreso del plan; si tampoco existe, se presenta un estado vacío explícito.

### Área principal

En escritorio, el formulario ocupa la columna principal y un resumen del atleta ocupa una columna lateral de 22rem. El resumen incluye fortalezas, limitadores y estado físico. En móvil, el resumen se coloca debajo del formulario.

Las métricas usan cuatro columnas en escritorio y dos columnas en móvil. Las pestañas pueden desplazarse horizontalmente en pantallas estrechas.

## Edición por pestañas

### General

- Foto de perfil: reemplazar o eliminar.
- Nombre.
- Edad.
- Ubicación.
- Sexo.
- Altura.
- Peso.
- Envergadura.
- Mano dominante.

### Escalada

- Grado actual.
- Grado objetivo.
- Máximo en búlder.
- Máximo en deportiva.
- Experiencia.
- Estilos fuertes.
- Proyecto actual.
- Foco técnico.
- Limitadores.

### Entrenamiento

- Disponibilidad.
- Carga semanal.
- Fuerza de dedos.
- Resistencia de dedos.
- Fuerza de tracción.
- Movilidad.
- Dolor o lesiones.
- Recuperación.
- Notas del entrenador.

### Cuenta

- Correo autenticado, de solo lectura.
- Tema visual.
- Exportación de datos.
- Zona de peligro para restablecer o eliminar datos.

Las acciones destructivas requieren `AlertDialog` y explican su alcance antes de confirmar.

## Estado y persistencia

El formulario mantiene un borrador único compartido por todas las pestañas. Cambiar de pestaña conserva las modificaciones, pero no las persiste. Cada pestaña presenta una acción `Guardar cambios`; al usarla se valida y guarda el borrador completo para evitar estados parciales contradictorios.

El guardado actualiza primero el registro local mediante el flujo de datos existente y luego intenta sincronizar con la nube. Un guardado local exitoso con fallo de nube se considera recuperable: se conserva el cambio y se muestra una advertencia de sincronización. Un error de validación aparece junto al campo correspondiente y mueve el foco al primer campo inválido.

Mientras se guarda, la acción se deshabilita y comunica progreso. Al finalizar se muestra una confirmación breve accesible. No se descartan cambios sin confirmación.

## Datos derivados

Las métricas se calculan a partir del perfil y del historial existente. Las funciones de cálculo deben permanecer separadas de los componentes visuales, ser deterministas y aceptar la fecha actual como argumento para facilitar las pruebas.

La edad es un dato declarado por el usuario, no se deriva de una fecha de nacimiento. Se muestra como número entero positivo seguido de `años`.

## Accesibilidad

- Estructura semántica con un encabezado principal y etiquetas visibles.
- Navegación completa por teclado.
- Foco visible mediante tokens `ring-ring`.
- Estados de error y guardado anunciados con regiones accesibles.
- Texto alternativo para la foto y fallback de iniciales en `Avatar`.
- Las métricas no dependen exclusivamente del color.

## Pruebas

- Renderizado de nombre, edad, ubicación, grados y estados ausentes.
- Cálculo de racha, sesiones semanales, carga y progreso, incluyendo entradas incompletas.
- Persistencia del borrador al cambiar de pestaña.
- Validación y foco en el primer error.
- Guardado local, sincronización exitosa y fallo recuperable de nube.
- Reemplazo y eliminación de foto.
- Confirmación de acciones destructivas.
- Distribución responsive en escritorio y móvil.
- Navegación por teclado y nombres accesibles principales.

## Fuera de alcance

- Perfil público o compartible.
- Comparación social con otros escaladores.
- Nuevos modelos de autenticación.
- Cambios en el algoritmo del plan de entrenamiento.
- Nuevas fuentes de métricas externas.
