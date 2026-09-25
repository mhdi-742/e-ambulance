-- ============================================
-- SEED DATA: Hospitals in Raiganj
-- ============================================

INSERT INTO public.hospitals (name, address, latitude, longitude, is_active) VALUES
  ('Raiganj Government Medical College & Hospital', 'Sudarshanpur, Raiganj, Uttar Dinajpur', 25.6234, 88.1289, TRUE),
  ('Raiganj Sub-Divisional Hospital', 'Station Road, Raiganj', 25.6198, 88.1201, TRUE),
  ('Uttar Dinajpur District Hospital', 'NH 34, Raiganj', 25.6145, 88.1150, TRUE),
  ('Islampur Sub-District Hospital', 'Islampur, Uttar Dinajpur', 25.5990, 88.1070, TRUE),
  ('Lifeline Nursing Home', 'College Para, Raiganj', 25.6210, 88.1230, TRUE)
ON CONFLICT DO NOTHING;
