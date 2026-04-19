# Cómo jugar al Prode del Mundial 2026

Bienvenido. Esta guía te lleva de cero a estar compitiendo con tus amigos en menos de 5 minutos.

## El juego en una frase

Predecís el resultado de cada uno de los 104 partidos del Mundial (72 de grupos + 32 de eliminatorias). A medida que se juegan, ganás puntos. El que más junta, gana.

## Sistema de puntaje

| Si acertaste... | Ganás |
|---|---|
| El resultado exacto (ej: predijiste 2-1 y salió 2-1) | **3 puntos** |
| Solo el ganador (ej: predijiste 2-1 y salió 4-3) | **1 punto** |
| Erraste el ganador | **0 puntos** |

Empate: si dos jugadores quedan con los mismos puntos, desempata primero el que tenga más aciertos exactos, después el que tenga más "solo ganador".

---

## Mini tour: 5 minutos para empezar a jugar

### 1. Entrá al app

Abrí la URL del app. La primera vez vas a ver una pantalla de bienvenida pidiéndote tu nombre.

- **Opción A (primera vez):** escribí tu nombre, apretá `Empezar`. El app te genera una identidad criptográfica automáticamente.
- **Opción B (ya jugaste antes en otro dispositivo):** apretá `Ya tengo cuenta`, pegá tus 12 palabras (ver "Migrar a otro dispositivo" más abajo), y listo.

Tu nombre lo podés cambiar después desde el input del topbar.

### 2. Cargá tus predicciones

Tenés dos modos arriba al centro: **Resultados** y **Predicciones**. Para jugar, elegí **Predicciones**.

Andá a **Grupos** en la barra lateral. Vas a ver 12 grupos (A a L), cada uno con 4 equipos y 6 partidos. Hacé click en cada partido y poné tu predicción (ej: Argentina 2 - Marruecos 0).

A medida que cargás, la **tabla de posiciones** del grupo se recalcula sola mostrando cómo quedarían clasificados los equipos según tus predicciones. La fila amarilla es el 3er puesto (relevante para los "mejores terceros" que pasan a 32avos).

**Atajo: regenerar random.** Si no tenés ganas de pensar las 104 predicciones, hay un botón `🎲 Regenerar random` en el menú `⋯` → sección "Predicciones". Usa un modelo de ratings por equipo para generar resultados realistas (Brasil le gana a Cabo Verde, Argentina-Francia queda parejo, etc.). Perfecto para probar el juego.

Después andá a **Eliminatorias** y cargá tus predicciones del knockout. Los cruces se arman solos según tus predicciones de grupos.

### 3. Competí con amigos (vía salas online)

Acá está la parte nueva. Usamos la red de Nostr para sincronizar predicciones peer-to-peer. Sin backend, sin servidor propio, sin cuentas en ningún lado.

**Si creás la sala:**

1. Barra lateral → **Salas** → `Crear sala`
2. Ponele un nombre (ej: "Asado 2026") y elegí el tipo:
   - **Abierta**: cualquiera con el link se puede unir
   - **Solo con invitación**: generás invites de un solo uso, más controlado
3. Click `Crear`. Vas a ver el código de la sala (8 caracteres, ej: `k7xm2p4a`) y el indicador `● Conectado` verde cuando los relays respondan.
4. Click `Invitar` → se abre un modal con:
   - El link directo a la sala (ej: `fixture.app/r/k7xm2p4a`)
   - Un QR code
   - Si es sala cerrada, un botón `Generar nuevo invite` que crea un código de un solo uso (ej: `fixture.app/r/k7xm2p4a?i=t8f2`)
5. Compartí el link por WhatsApp/Telegram/donde sea. Cada amigo que lo abra en su app entra automáticamente.

**Si te invitan a una sala:**

- Abrí el link que te mandaron. El app te pide que te logees (o usás tu identidad existente si ya tenés) y te mete en la sala automáticamente.
- También podés entrar manualmente: `Salas` → `Unirme` → pegás el código de 8 caracteres.

**Qué pasa en la sala:**

- Tus predicciones se envían automáticamente al Nostr relay (encriptadas con un "commitment" hasta que el partido arranque — nadie puede ver qué predijiste antes de que se cierre)
- Cuando un partido se cierra (1 hora antes del kickoff), tu predicción se "revela" públicamente
- Los rivales de la sala aparecen en el **Ranking** del app, comparándose contra los resultados reales

**El ranking se actualiza solo** a medida que los partidos se juegan y vos cargás los resultados reales.

### 4. Modo "Simulación": jugá el mundial antes que empiece

Esto es clave si querés probar el juego antes de que haya partidos reales.

1. Asegurate de estar en **Predicciones** y tener tus predicciones cargadas (y las de tus rivales si querés ver cómo quedaría el ranking)
2. Menú `⋯` → sección "Simulación" → `Iniciar simulación`
3. El app entra en modo simulación (vas a ver un punto ambar pulsante en el sidebar: `● Simulación`)
4. Para cada partido pendiente (en orden cronológico) tenés 3 opciones:
   - `▶ Simular random`: genera un resultado realista con el mismo modelo que el randomize
   - `✎ Ingresar manual`: ponés vos el score que quieras probar
   - `⏭ Saltar`: lo salteás y vas al siguiente
5. Después de cada partido ves:
   - El resultado y quién ganó
   - Cuántos puntos ganó cada jugador en ese partido (con símbolos `✓` exacto, `½` solo ganador, `✗` erró)
   - El ranking actualizado con flechas (`↑1`, `↓2`) indicando subidas/bajadas
6. `▶ Siguiente partido` para continuar
7. Cuando quieras, `Salir` — el app **restaura todo al estado real** (los resultados simulados desaparecen, tus predicciones quedan intactas)

La simulación es **efímera**: si recargás el browser mid-simulación, perdés el avance y volvés a tu prode real. Eso garantiza que no te va a contaminar el juego real.

---

## Migrar a otro dispositivo (backup de cuenta)

Tu identidad en el app es una llave criptográfica (estilo Bitcoin wallet). Si querés seguir jugando desde otro dispositivo, necesitás **backup de tu seed phrase** (12 palabras).

**Para backupear:**

1. Menú `⋯` → `Mi cuenta`
2. Click `Mostrar seed phrase`
3. Las 12 palabras aparecen — copialas con el botón `Copiar` y guardalas en un lugar seguro (password manager, papel, lo que sea). **No las compartas con nadie.**
4. Alternativa: `Mostrar QR` — muestra la misma info en formato QR para escanear desde otro device

**Para restaurar:**

1. En el dispositivo nuevo, pantalla de bienvenida → `Ya tengo cuenta`
2. Pegá las 12 palabras
3. Click `Restaurar`

Tu identidad vuelve a ser la misma. Cuando entres a tus salas (via invite link), el app re-sincroniza los rivales desde los relays automáticamente.

**Ojo:** las predicciones que tenías cargadas localmente **no** se migran automáticamente. Si querés transferirlas, usá `⋯ → Fixture → Exportar todo` en el device viejo y `Importar todo` en el nuevo.

---

## Preguntas frecuentes

**¿Pueden mis amigos ver mis predicciones antes del partido?**

No. Hasta 1 hora antes del kickoff de cada partido, lo único que se publica es un "commitment" (hash SHA-256 de tu predicción + un salt aleatorio). Ni ellos ni yo (ni el relay) podemos ver el score que predijiste. Recién cuando el partido se "cierra" el app revela la predicción original. Si intentás cambiar la predicción después del cierre, el hash ya no matchea y los rivales te rechazan.

**¿Qué pasa si cambia mi nombre?**

Nada importante. Tu identidad real es tu llave (npub), no tu nombre. Dos personas pueden llamarse "Juan" y el app los distingue por la llave. Podés cambiar tu nombre en cualquier momento desde el topbar.

**¿Puedo estar en varias salas a la vez?**

Sí. Cada sala es independiente. El ranking en cada sala solo cuenta los jugadores de esa sala.

**¿Qué pasa si no tengo internet?**

El app funciona 100% local cuando querés cargar predicciones. Cuando vuelve la conexión, se sincroniza con los relays. Si hiciste cambios offline, quedan encolados y se publican automáticamente al reconectar.

**¿Cómo salgo de una sala?**

Entrar a la sala → botón `Salir` (rojo). Te desconecta de esa sala. Podés volver a entrar con el mismo link.

**¿Puedo jugar sin crear una sala?**

Sí, podés cargar predicciones y simular mundial localmente sin Nostr. Es el modo "sandbox" — no hay ranking con amigos pero podés ver cómo te irían las predicciones contra resultados reales (o simulados).

**¿Los datos están encriptados?**

Tus predicciones antes de cierre: sí (commit-reveal con SHA-256). Después del cierre del partido, son públicas en el relay (cualquiera que conozca el roomId puede verlas). Tu seed phrase nunca sale del dispositivo.

---

## Checklist para empezar a competir hoy

- [ ] Abrir el app, poner tu nombre
- [ ] Cargar predicciones (o `🎲 Regenerar random` para empezar rápido)
- [ ] Crear sala → obtener link de invitación
- [ ] Compartir el link con tus amigos
- [ ] Backup de la seed phrase en un lugar seguro
- [ ] (Opcional) Probar una simulación entera para ver cómo quedaría el ranking

Listo. A competir.
