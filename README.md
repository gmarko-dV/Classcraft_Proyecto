# 🎮 Classcraft - Sistema Gamificado de Clases

Este proyecto es un sistema web educativo inspirado en **Classcraft**, diseñado para gamificar la experiencia de los estudiantes en clase. Permite gestionar usuarios, clases, secciones, artículos virtuales, puntos de experiencia y vida.

## 🚀 Tecnologías utilizadas

- 🟩 Node.js (Express)
- 🐬 MySQL
- 🌐 HTML5
- 🎨 CSS3 
- 🧠 JavaScript

## ⚙️ Requisitos

- Tener instalado:
  - Node.js v14 o superior
  - MySQL Server
  - Navegador web moderno

---

## 🛠️ Pasos para ejecutar el proyecto

### 1. Clona el repositorio

```bash
git clone https://github.com/gmarko-dV/Classcraft_Proyecto.git
cd Classcraft_Proyecto

2. Instala las dependencias
npm install
3. Importa la base de datos
Ejecuta el archivo script-classscraft.sql que se encuentra en la raíz del proyecto:
4. Verifica la conexión a MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'tucontraseña',
  database: 'classcraft'
});
5. Ejecuta el servidor
node server.js
