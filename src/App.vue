
<script setup lang="ts">
</script>

<template>
  <main class="app-container">
    <div class="welcome">
      <h1>LERABOT</h1>
      <p>Plataforma de gestión de inversiones en criptomonedas</p>
      <span>Proyecto inicializado correctamente</span>
    </div>
  </main>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome {
  text-align: center;
}

h1 {
  font-size: 3rem;
  font-weight: 700;
  color: #2563eb;
}

p {
  margin: 12px 0;
  color: #64748b;
}

span {
  font-size: 0.875rem;
  color: #16a34a;
}
</style>