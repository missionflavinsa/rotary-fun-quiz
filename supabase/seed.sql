-- =============================================
-- SEED DATA FOR ROTARY FUN QUIZ
-- Works with basic table structure
-- =============================================

DO $$
DECLARE
  class_9_id UUID;
  class_10_id UUID;
  class_11_id UUID;
  math_9_id UUID;
  math_10_id UUID;
  physics_10_id UUID;
  chemistry_10_id UUID;
  algebra_id UUID;
  geometry_id UUID;
  motion_id UUID;
  polynomials_id UUID;
  linear_eq_id UUID;
  triangles_id UUID;

BEGIN
  -- CLASSES
  INSERT INTO public.classes (name, section) VALUES ('Class 9', 'A') RETURNING id INTO class_9_id;
  INSERT INTO public.classes (name, section) VALUES ('Class 10', 'A') RETURNING id INTO class_10_id;
  INSERT INTO public.classes (name, section) VALUES ('Class 11', 'Science') RETURNING id INTO class_11_id;

  -- STUDENTS
  INSERT INTO public.students (full_name, roll_no, class_id) VALUES ('Rahul Sharma', '101', class_10_id);
  INSERT INTO public.students (full_name, roll_no, class_id) VALUES ('Priya Patel', '102', class_10_id);
  INSERT INTO public.students (full_name, roll_no, class_id) VALUES ('Amit Kumar', '103', class_10_id);
  INSERT INTO public.students (full_name, roll_no, class_id) VALUES ('Sneha Gupta', '104', class_10_id);
  INSERT INTO public.students (full_name, roll_no, class_id) VALUES ('Vikram Singh', '105', class_10_id);
  INSERT INTO public.students (full_name, roll_no, class_id) VALUES ('Anjali Reddy', '201', class_9_id);
  INSERT INTO public.students (full_name, roll_no, class_id) VALUES ('Rohan Joshi', '202', class_9_id);

  -- SUBJECTS
  INSERT INTO public.subjects (name, class_id) VALUES ('Mathematics', class_9_id) RETURNING id INTO math_9_id;
  INSERT INTO public.subjects (name, class_id) VALUES ('Science', class_9_id);
  INSERT INTO public.subjects (name, class_id) VALUES ('Mathematics', class_10_id) RETURNING id INTO math_10_id;
  INSERT INTO public.subjects (name, class_id) VALUES ('Physics', class_10_id) RETURNING id INTO physics_10_id;
  INSERT INTO public.subjects (name, class_id) VALUES ('Chemistry', class_10_id) RETURNING id INTO chemistry_10_id;

  -- TOPICS
  INSERT INTO public.topics (name, subject_id) VALUES ('Algebra', math_10_id) RETURNING id INTO algebra_id;
  INSERT INTO public.topics (name, subject_id) VALUES ('Geometry', math_10_id) RETURNING id INTO geometry_id;
  INSERT INTO public.topics (name, subject_id) VALUES ('Motion', physics_10_id) RETURNING id INTO motion_id;
  INSERT INTO public.topics (name, subject_id) VALUES ('Chemical Reactions', chemistry_10_id);
  INSERT INTO public.topics (name, subject_id) VALUES ('Number Systems', math_9_id);

  -- SUBTOPICS
  INSERT INTO public.subtopics (name, topic_id) VALUES ('Polynomials', algebra_id) RETURNING id INTO polynomials_id;
  INSERT INTO public.subtopics (name, topic_id) VALUES ('Linear Equations', algebra_id) RETURNING id INTO linear_eq_id;
  INSERT INTO public.subtopics (name, topic_id) VALUES ('Triangles', geometry_id) RETURNING id INTO triangles_id;
  INSERT INTO public.subtopics (name, topic_id) VALUES ('Circles', geometry_id);
  INSERT INTO public.subtopics (name, topic_id) VALUES ('Speed and Velocity', motion_id);
  INSERT INTO public.subtopics (name, topic_id) VALUES ('Acceleration', motion_id);

  -- QUESTIONS (minimal columns only)
  INSERT INTO public.questions (content, type, options, correct_answer, points, subtopic_id) VALUES
  ('What is the degree of the polynomial 3x² + 5x - 7?', 'mcq', '["1", "2", "3", "0"]', '2', 10, polynomials_id),
  ('If 2x + 3 = 11, what is the value of x?', 'mcq', '["2", "3", "4", "5"]', '4', 10, linear_eq_id),
  ('The sum of angles in a triangle is:', 'mcq', '["90°", "180°", "270°", "360°"]', '180°', 10, triangles_id),
  ('Which polynomial has roots 2 and 3?', 'mcq', '["x² - 5x + 6", "x² + 5x + 6", "x² - 5x - 6", "x² + 5x - 6"]', 'x² - 5x + 6', 15, polynomials_id);

  INSERT INTO public.questions (content, type, correct_answer, points, subtopic_id) VALUES
  ('If P(x) = x³ - 3x² + 2x + k has factor (x-1), find k.', 'integer', '0', 20, polynomials_id),
  ('Polygon with interior angle sum 720° has how many sides?', 'integer', '6', 15, triangles_id);

  RAISE NOTICE 'Seed data inserted successfully!';
END $$;

-- Verify
SELECT 'Classes' as table_name, COUNT(*) as count FROM public.classes
UNION ALL SELECT 'Students', COUNT(*) FROM public.students
UNION ALL SELECT 'Subjects', COUNT(*) FROM public.subjects
UNION ALL SELECT 'Topics', COUNT(*) FROM public.topics
UNION ALL SELECT 'Subtopics', COUNT(*) FROM public.subtopics
UNION ALL SELECT 'Questions', COUNT(*) FROM public.questions;
