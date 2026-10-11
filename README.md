# EduPortal REST API (MongoDB + Mongoose) 🍃

Backend oficial para el sistema y curso **EduPortal (Angular 22)** implementado con **Node.js, Express, TypeScript, MongoDB y Mongoose**.

Provee una API REST desacoplada y robusta para la gestión escolar, consumida mediante HTTP (`HttpClient`, interceptores, JWT, reactividad RxJS y Signals) desde la aplicación frontend en Angular.

---

## 🎯 Arquitectura y Tecnologías

1. **Runtime:** Node.js (v20 o v22 LTS) con TypeScript 5.6.
2. **Servidor HTTP:** Express 4.21 con Helmet, CORS y rate limiting.
3. **Base de Datos NoSQL:** **MongoDB** (versión 6.0 o 7.0+) mediante **Mongoose 8.9**.
4. **Seguridad y Auth:** Autenticación basada en JSON Web Tokens (JWT) y hashing de contraseñas con `bcryptjs`.
5. **Validación:** Esquemas tipados con `zod`.

---

## 🚀 Requisitos Previos

* **Node.js**: v18.0.0 o superior (recomendado v20+ LTS).
* **MongoDB**:
  * **Opción Local**: [MongoDB Community Server](https://www.mongodb.com/try/download/community) corriendo en `mongodb://localhost:27017`.
  * **Opción Cloud**: Clúster gratuito en [MongoDB Atlas](https://www.mongodb.com/atlas/database) (`mongodb+srv://...`).

---

## ⚙️ Instalación y Configuración

1. **Instalar dependencias**:
   ```bash
   cd "C:\Users\felix\Desktop\Curso Angular\eduportal-api-mongodb"
   npm install
   ```

2. **Configurar el entorno (`.env`)**:
   Verifica o edita tu archivo `.env`:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/eduportal
   JWT_SECRET=super_secret_jwt_eduportal_2026_minedu_peru_development_key_secure_32
   CORS_ORIGIN=http://localhost:4200
   DEFAULT_PASSWORD=12345678
   ```

3. **Poblar la base de datos (Seed)**:
   Puebla la base de datos completa con los 11 cursos oficiales de secundaria, 10 secciones, 14 profesores con jornada, 100 alumnos matriculados y 1200 actas de notas:
   ```bash
   npm run db:seed
   ```
   *(También cuentas con el script nativo `init-mongo.js` para ejecutar desde `mongosh` o MongoDB Compass).*

4. **Compilar e Iniciar el servidor**:
   * **Modo desarrollo (con recarga en vivo):**
     ```bash
     npm run dev
     ```
   * **Modo producción:**
     ```bash
     npm run build
     npm start
     ```

El servidor iniciará en `http://localhost:3000`.

---

## 🔑 Credenciales de Acceso Iniciales

Todas las cuentas vienen configuradas con la contraseña predeterminada: **`12345678`**

| Rol | Correo Institucional | Perfil / Permisos |
| :--- | :--- | :--- |
| **Super Administrador** | `alex.valdivia.00000001@colegiocolombia.edu.pe` | `FULL` en todos los módulos |
| **Director General** | `roberto.castillo.10234567@colegiocolombia.edu.pe` | `FULL` pedagógico y curricular |
| **Administrador / UGEL** | `marco.polo.10987654@colegiocolombia.edu.pe` | `FULL` administrativo |
| **Docente (Matemática)** | `carlos.mendoza.10482910@colegiocolombia.edu.pe` | `FULL` en sus asignaturas asignadas |
| **Docente (Comunicación)**| `ana.velasquez.10482911@colegiocolombia.edu.pe` | `FULL` en sus asignaturas asignadas |
| **Estudiante** | `mateo.quispe.71000001@colegiocolombia.edu.pe` | Solo lectura de su propio expediente |

---

## 📡 Endpoints Oficiales de la API REST

### 1. Autenticación (`/api/auth`)
* `POST /api/auth/login` - Inicio de sesión (retorna token JWT y datos del usuario)
* `GET /api/auth/me` - Perfil y permisos del usuario autenticado
* `POST /api/auth/change-password` - Cambio de contraseña

### 2. Estudiantes (`/api/students`)
* `GET /api/students` - Lista de estudiantes (parámetros: `?grade=...&section=...&search=...`)
* `GET /api/students/:id` - Expediente completo del estudiante con notas
* `POST /api/students` - Matrícula de nuevo estudiante
* `PUT /api/students/:id` - Actualización de ficha del estudiante
* `PATCH /api/students/:id/toggle-status` - Habilitar o deshabilitar estudiante (soft-delete con bandera de estado)

### 3. Calificaciones (`/api/grades`)
* `GET /api/grades` - Actas de notas oficiales MINEDU (bimestres 1 a 4 y promedios)
* `PATCH /api/grades/batch` - Registro masivo de notas por bimestre
* `PATCH /api/grades/:studentId/:subjectId` - Calificación de celda individual

### 4. Cursos y Materias (`/api/subjects`)
* `GET /api/subjects` - Catálogo de los 11 cursos oficiales de la malla curricular
* `GET /api/subjects/:id` - Detalle de un curso
* `POST /api/subjects` - Registro de nueva materia
* `PUT /api/subjects/:id` - Modificar información curricular
* `PATCH /api/subjects/:id/toggle-status` - Alternar estado activo / inactivo
* `PATCH /api/subjects/:id/teacher` - Reasignación de docente titular (con auditoría)
* `GET /api/subjects/:id/history` - Historial de auditoría de cátedra

### 5. Plana Docente (`/api/teachers`)
* `GET /api/teachers` - Nómina de profesores, carga horaria y jornada
* `GET /api/teachers/:id` - Ficha docente y secciones asignadas
* `POST /api/teachers` - Registro de docente con correo institucional autogenerado
* `PUT /api/teachers/:id` - Actualizar docente y asignaciones de aula
* `PATCH /api/teachers/:id/toggle-status` - Alternar estado activo / inactivo

### 6. Grados y Secciones (`/api/grade-sections`)
* `GET /api/grade-sections` - 10 aulas con vacantes en tiempo real
* `POST /api/grade-sections` - Crear nueva sección escolar
* `PATCH /api/grade-sections/:id/toggle-status` - Alternar estado activo / inactivo
* `GET /api/grade-sections/subjects` - Malla curricular por grados escolares
* `PUT /api/grade-sections/subjects/:grade` - Actualizar cursos de un grado

### 7. Configuración Escolar (`/api/config`)
* `GET /api/config/academic-years` - Lista de años lectivos y estado de bimestres (`isOpen`)
* `PUT /api/config/academic-years` - Crear o actualizar año escolar
* `PATCH /api/config/academic-years/:id/activate` - Activar año escolar oficial
* `GET /api/config/:key` - Parámetros institucionales (`school`) o reglas de negocio (`rules`)
* `PUT /api/config/:key` - Modificar parámetros y reglas

### 8. Perfiles y Permisos (`/api/profiles`)
* `GET /api/profiles` - Matriz de roles y permisos RBAC del colegio
* `POST /api/profiles` - Creación de perfil personalizado
* `PUT /api/profiles/:id` - Actualización de permisos de un perfil
* `PATCH /api/profiles/:id/toggle-status` - Alternar estado activo / inactivo de perfil (protege perfiles de sistema)

### 9. Cuentas de Usuario (`/api/users`)
* `GET /api/users` - Lista de usuarios institucionales
* `POST /api/users` - Crear usuario administrativo o directivo
* `PATCH /api/users/:id/toggle-status` - Bloquear o desbloquear acceso web
