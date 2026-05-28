# Gestión de Pares Evaluadores — Universidad de Nariño

## Contexto
App desarrollada para el monitor de Vicerrectoría Académica.
Gestiona el proceso de búsqueda y seguimiento de pares evaluadores 
para trabajos de ascenso y productividad académica.

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
- Power Automate y Power Apps para buscador de pares con IA

## Próximos pasos planificados
- [ ] Checklist de 12 documentos por proceso
- [ ] Base de datos Supabase (reemplaza localStorage)
- [ ] Exportación a Excel con SheetJS
- [ ] Integración OneDrive institucional (Microsoft Graph API)

## Decisiones tomadas
- GitHub Pages para publicar (solo estático por ahora)
- Supabase como base de datos cuando se migre
- SheetJS para el Excel en su momento