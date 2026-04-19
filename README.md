# Dental_Clinic

#apponitment guid

GET: /api/v1/appointments --admin {
Optional — same style as users: page, limit, sort, fields, plus filters on appointment fields (e.g. patientId, doctorId, status, date[gte]=...).
help in pagination
}

GET :/api/v1/appointments/me --normal user

POST: /api/v1/appointments --patient only
{
doctorId ,date ,duration ,notes
}

GET: /api/v1/appointments/:id --avilable admin or patient

PATCH: /api/v1/appointments/:id {
date,,duration,notes,status,adminNotes,notificationSent
}

PATCH: /api/v1/appointments/:id/cancel

DELETE: /api/v1/appointments/:id
