-- Update handle_new_user trigger to only create profiles for admin/employee users.
-- Workers and partners invited via invitePortalUser (no role metadata) will NOT
-- get a profiles entry, so they won't appear in the admin team list.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := NEW.raw_user_meta_data->>'role';
  IF user_role IN ('admin', 'employee') THEN
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.email,
      user_role
    );
  END IF;
  RETURN NEW;
END;
$$;
