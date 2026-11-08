# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities and who is registered
- Teacher login (Admin Mode): only logged-in teachers can register or unregister students

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Run the application:

   ```
   python app.py
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                              | Description                                                          | Auth    |
| ------ | --------------------------------------------------------------------- | -------------------------------------------------------------------- | ------- |
| GET    | `/activities`                                                         | Get all activities with their details and current participant count | Public  |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu`     | Register a student for an activity                                   | Teacher |
| DELETE | `/activities/{activity_name}/unregister?email=student@mergington.edu` | Unregister a student from an activity                                | Teacher |
| POST   | `/auth/login`                                                         | Log in with `{"username": ..., "password": ...}`; returns a token    | Public  |
| POST   | `/auth/logout`                                                        | End the current session                                              | Teacher |
| GET    | `/auth/me`                                                            | Get the logged-in teacher                                            | Teacher |

Teacher endpoints require an `Authorization: Bearer <token>` header using the token returned by `/auth/login`. Sessions expire after 8 hours and are reset when the server restarts.

## Teacher Accounts

Teacher accounts are stored in `teachers.json` as salted PBKDF2 password hashes (never plain text). There is no account maintenance page; passwords are assigned with the helper script, run from the `src` directory:

```
python manage_teachers.py set jsmith --name "Mr. Smith"   # create or reset a password
python manage_teachers.py remove jsmith
python manage_teachers.py list
```

A demo account is included for local development: username `mrodriguez`, password `teacher-demo-123`. Reset or remove it before using the app for real.

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

All data is stored in memory, which means data will be reset when the server restarts.
