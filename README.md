# SigePac — Gestión de Pares Evaluadores

Aplicación web para el monitor de **Vicerrectoría Académica** de la Universidad de Nariño. Permite gestionar el proceso completo de búsqueda, seguimiento y pago de pares evaluadores para trabajos de ascenso y productividad académica.

## ¿Qué hace?

- **Pares** — Registrar, editar y buscar evaluadores externos con su área de expertise, institución y perfil SCIENTI/CvLAC.
- **Conceptos** — Registrar los trabajos a evaluar (ascenso o productividad académica) y asignarles pares.
- **Seguimiento** — Rastrear el proceso en 7 etapas, con fecha registrada en cada avance.
- **Checklist de documentos** — Controlar los 12 documentos requeridos para enviar a Tesorería.
- **Correos** — Generar plantillas de invitación y confirmación listas para copiar.
- **Historial** — Ver todos los procesos completados con su línea de tiempo completa.

## Proceso que gestiona

```
1. Buscar 2 pares con estudios afines al área del concepto
2. Enviar invitación por correo
3. Si acepta → enviar documentos, esperar resultado
4. Resultado recibido → confirmar al par, solicitar cuenta de cobro
5. Cuenta de cobro recibida → esperar pago de estampillas
6. Organizar 12 documentos → enviar a Tesorería
```

## Tecnologías

- HTML5 + CSS3 + JavaScript puro (sin frameworks)
- `localStorage` para persistencia de datos
- [Tabler Icons](https://tabler.io/icons) para íconos
- [Inter](https://fonts.google.com/specimen/Inter) como tipografía
- Publicado en **GitHub Pages**

## Uso

Abrir `index.html` en el navegador, o acceder a la URL de GitHub Pages del repositorio.

Los datos se guardan automáticamente en el navegador (localStorage). No requiere servidor ni conexión a internet después de cargar la página.

---

*Universidad de Nariño — Vicerrectoría Académica*
