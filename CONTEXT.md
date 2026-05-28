# Gestión de Pares Evaluadores — Universidad de Nariño

## Contexto
App desarrollada para el monitor de Vicerrectoría Académica.
Gestiona el proceso de búsqueda y seguimiento de pares evaluadores 
para trabajos de ascenso y productividad académica.

## URL de producción
https://chrissar19.github.io/SigePac/

## El proceso que maneja la app
1. Buscar 2 pares con estudios relacionados al área del concepto
2. Enviar invitación por correo (plantilla definida)
3. Si acepta → enviar documentos y esperar resultado
4. Al recibir resultado → confirmar al par y solicitar cuenta de cobro
5. Al recibir cuenta de cobro → esperar pago de estampillas
6. Organizar 12 documentos y enviar a tesorería

## Stack actual
- HTML + CSS + JavaScript puro
- localStorage para persistencia (temporal)
- Tabler Icons + Inter (Google Fonts)
- GitHub Pages para despliegue

## Próximos pasos planificados
- [x] Checklist de 12 documentos por proceso
- [x] Refactorización HTML/CSS/JS + buenas prácticas
- [x] Colores institucionales (#265531 verde, #dfa013 dorado)
- [x] Editar par y concepto
- [x] Modal para asignar par
- [x] Fecha por etapa
- [x] Historial de completados
- [x] Publicado en GitHub Pages
- [ ] Exportación a Excel con SheetJS
- [ ] Base de datos Supabase (reemplaza localStorage)
- [ ] Integración OneDrive institucional (Microsoft Graph API)

## Decisiones tomadas
- GitHub Pages para publicar (estático)
- Supabase como base de datos cuando se migre
- SheetJS para el Excel en su momento
- Sin Power Apps / Power Automate (solo cubre plan básico Microsoft)
- Sin Claude API por ahora (pendiente decisión)
