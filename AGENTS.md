# AGENTS.md — Cromi Intelligence

Estas instrucciones se aplican a **todo el repositorio** y a cualquier agente o asistente que proponga, escriba, revise o publique código.

## Principio obligatorio: investigar antes de implementar

**No reinventar capacidades que ya están resueltas de manera fiable por bibliotecas o estándares existentes.** Tampoco incorporar dependencias simplemente porque son populares. Antes de iniciar una funcionalidad o una refactorización significativa, realizar y dejar documentada una evaluación de alternativas.

### 1. Entender el problema y revisar el código existente

- Precisar qué necesidad resuelve, entradas, salidas, restricciones y criterios de aceptación.
- Buscar primero en este repositorio código, adaptadores, bibliotecas y pruebas que ya cubran parte o toda la función.
- Distinguir lógica específica de Cromi de capacidades genéricas (tokenización, normalización, búsquedas, trigramas, distancia de edición, embeddings, análisis PDF, OCR, parsers, sesiones, interfaces de chat, etc.).
- Verificar si la solución propuesta requiere realmente un componente nuevo.

### 2. Investigar el estado del arte antes de elegir una implementación

Comparar **al menos dos alternativas razonables cuando existan**: (a) reutilización de código actual, (b) biblioteca open source consolidada, (c) API o estándar del entorno, (d) implementación propia mínima solo si está justificada.

Para cada alternativa pertinente, comprobar:
- Funcionalidades realmente disponibles y compatibilidad con el caso de uso.
- Estado de mantenimiento, documentación, versiones, issues relevantes y seguridad conocida.
- Licencia y posibilidad de uso, modificación y distribución en proyectos de terceros.
- Dependencias, peso, rendimiento, plataformas compatibles y costos operativos.
- Evidencia de **uso en productos reales**, cuando sea verificable (documentación pública, repositorios consumidores, casos de estudio o pruebas independientes).
- Problemas o **fracasos documentados**: limitaciones, bugs, incidentes, degradaciones, edge cases, mantenimiento abandonado, migraciones o decisiones de descarte. Incluir también qué enfoques *no* funcionaron en este repositorio, respaldado por pruebas o historial.

No confundir estrellas de GitHub, publicidad, popularidad o una demo con evidencia de éxito en producción. No inventar referencias, usuarios, adopción, benchmarks ni experiencias negativas. Indicar explícitamente **«no verificado»** cuando falten fuentes; incluir fecha y enlaces verificables al investigar información externa.

### 3. Registrar una decisión antes de escribir código

En la descripción del cambio, issue o documentación asociada registrar de forma breve:

1. **Problema concreto** y comportamiento esperado.
2. **Qué ya existe** en Cromi y fuera de él, con enlaces o rutas.
3. **Qué se sabe que funcionó** en otros productos y qué evidencia lo respalda.
4. **Qué no funcionó o presenta límites**, indicando si se trata de un fallo comprobado, una advertencia documentada o un riesgo hipotético.
5. **Comparación** de opciones (funcionalidad, mantenimiento, licencia, seguridad, rendimiento, complejidad y costo).
6. **Decisión adoptada** y por qué. Si se escribe algo propio, explicar qué requisito comprobable no cubren las alternativas existentes.
7. **Pruebas y criterios de aceptación**, incluidos casos límite y regresiones.

Un cambio de documentación o corrección trivial puede usar una evaluación abreviada. Para algoritmos, NLP, parsing, búsquedas, memoria, visión, RAG, seguridad, concurrencia o dependencias nuevas, la evaluación es **obligatoria**. Si no hay acceso a fuentes externas, declararlo y no afirmar comparaciones o adopción no comprobadas.

### 4. Preferir composición e interoperabilidad

- Usar interfaces, adaptadores y plugins reutilizables; mantener el motor independiente de un producto, empresa o dominio.
- Reutilizar funciones probadas para capacidades genéricas, en lugar de crear implementaciones paralelas con nombres distintos.
- No incorporar un LLM como dependencia obligatoria ni APIs de inferencia comerciales o de pago. Ollama u otros modelos locales deben seguir siendo **opcionales**.
- No acoplar funcionalidades de negocio al núcleo. Mantener demos, integraciones y experiencia visual separadas de las bibliotecas públicas.
- Las dependencias nuevas deben justificarse por beneficio real, mantenimiento y licencia.

### 5. Privacidad, secretos y seguridad: condición de publicación

- **Nunca** copiar, exponer o derivar datos, código, recursos o reglas exclusivas de productos o repositorios privados al proyecto público.
- No incluir nombres comerciales privados, dominios internos, URL de infraestructura, identificadores de clientes, logs privados, archivos locales, configuraciones reales o credenciales, aunque parezcan ejemplos inocentes.
- Nunca publicar claves API, contraseñas, tokens, cookies, certificados, archivos `.env` o secretos en código, tests, ejemplos, documentación, commits ni historial Git.
- Usar únicamente datos **sintéticos** en tests y ejemplos; no copiar contenido de documentos de clientes.
- Revisar el **diff completo** y las incorporaciones antes de cada commit o publicación. Si se detecta un secreto, **detener la publicación**, no basta con borrarlo de un commit posterior; coordinar la rotación y eliminación segura del historial.
- No crear endpoints públicos de upload/chat sin autenticación, autorización, aislamiento entre usuarios, límites, protección contra abuso y manejo seguro de archivos. Una demo en `localhost` no es un backend de producción.
- Para documentos no confiables, validar tamaño, formato y límites de recursos; no tratar el contenido como instrucciones ejecutables.

### 6. Validar antes de declarar «listo»

- Reproducir el problema antes de cambiar código, si hay un bug.
- Agregar pruebas de regresión que cubran fallo previo, caso exitoso y límites relevantes.
- Ejecutar `npm test` y las demos afectadas cuando el entorno lo permita; distinguir **pruebas efectivamente ejecutadas** de las solo añadidas.
- No afirmar «funciona», «probado en producción», «seguro» o «sin vulnerabilidades» sin evidencia del nivel de validación correspondiente.
- No generar ramas, automatizaciones, workflows o servicios innecesarios. Respetar el alcance solicitado y evitar cambios ajenos a la tarea.

## Plantilla breve de evaluación previa

```md
### Evaluación técnica previa
- Problema y criterios de aceptación:
- Implementaciones existentes en este repositorio:
- Alternativa A (licencia, mantenimiento, compatibilidad, fuente):
- Alternativa B (licencia, mantenimiento, compatibilidad, fuente):
- Evidencia verificable de uso en productos reales:
- Fallos conocidos / enfoques descartados (fuente y grado de certeza):
- Costos y riesgos (seguridad, rendimiento, dependencias):
- Decisión: reutilizar / integrar / adaptar / implementar
- Por qué no alcanza lo existente (solo si se implementa algo propio):
- Pruebas a ejecutar y resultado obtenido:
```

**Regla final:** primero comprender e investigar, después comparar y justificar, y **recién entonces** implementar. No reinventar la rueda por defecto ni atribuir originalidad a técnicas ya consolidadas.
