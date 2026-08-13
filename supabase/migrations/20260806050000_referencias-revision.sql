-- =====================================================================
-- REFERENCIAS EN LA REVISIÓN (fase 8.1, "adjuntar referencias")
-- =====================================================================
-- "Quiero la portada más como ESTO" necesita un esto: el cliente puede
-- adjuntar UNA imagen a cada comentario de su revisión. La imagen va al
-- bucket PRIVADO de siempre (fotos-pedidos), bajo referencias/, y aquí
-- solo se guarda su ruta — el panel la enseña con URL firmada, como las
-- fotos y los comprobantes.
--
-- Límites (validados en servidor, src/app/api/revision/*): JPG/PNG/WEBP,
-- 8 MB, y un tope de imágenes por revisión para proteger el Storage.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

alter table public.comentarios
  add column if not exists imagen_ruta text;
