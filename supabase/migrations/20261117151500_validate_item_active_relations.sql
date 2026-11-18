BEGIN;

CREATE OR REPLACE FUNCTION public.validate_item_active_relations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_validate_category boolean;
  v_validate_supplier boolean;
  v_is_active boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_validate_category := true;
    v_validate_supplier := NEW.supplier_id IS NOT NULL;
  ELSE
    v_validate_category := NEW.category_id IS DISTINCT FROM OLD.category_id;
    v_validate_supplier :=
      NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
      AND NEW.supplier_id IS NOT NULL;
  END IF;

  IF v_validate_category THEN
    IF NEW.category_id IS NULL THEN
      RAISE EXCEPTION 'An active category is required for an item.'
        USING ERRCODE = '23514';
    END IF;

    -- Hold a conflicting row lock until commit so deactivation cannot race this check.
    SELECT c.is_active
    INTO v_is_active
    FROM public.categories AS c
    WHERE c.id = NEW.category_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The selected category does not exist.'
        USING ERRCODE = '23503';
    END IF;
    IF NOT v_is_active THEN
      RAISE EXCEPTION 'The selected category is inactive.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_validate_supplier THEN
    SELECT s.is_active
    INTO v_is_active
    FROM public.suppliers AS s
    WHERE s.id = NEW.supplier_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The selected supplier does not exist.'
        USING ERRCODE = '23503';
    END IF;
    IF NOT v_is_active THEN
      RAISE EXCEPTION 'The selected supplier is inactive.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER items_validate_active_relations
  BEFORE INSERT OR UPDATE OF category_id, supplier_id
  ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_item_active_relations();

COMMIT;
