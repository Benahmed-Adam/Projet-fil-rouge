SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."accepter_invitation"("invitation_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_channel uuid;
begin
    update public.channel_invitations
    set status = 'accepted', responded_at = now()
    where id = invitation_id
      and invitee_id = auth.uid()
      and status = 'pending'
      and expires_at > now()
    returning channel_id into v_channel;

    if v_channel is null then
        raise exception 'Invitation invalide ou expirée.';
    end if;

    insert into public.channel_members (channel_id, user_id)
    values (v_channel, auth.uid())
    on conflict do nothing;

    return v_channel;
end;
$$;
ALTER FUNCTION "public"."accepter_invitation"("invitation_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."ajouter_proprietaire"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
    insert into public.channel_members (channel_id, user_id, role)
    values (new.id, new.created_by, 'owner');
    return new;
end;
$$;
ALTER FUNCTION "public"."ajouter_proprietaire"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."creer_profil"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
    insert into public.profiles (id, username)
    values (new.id, new.raw_user_meta_data ->> 'username');
    return new;
end;
$$;
ALTER FUNCTION "public"."creer_profil"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."est_membre_salon"("salon" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select exists (
        select 1 from public.channel_members
        where channel_id = salon and user_id = auth.uid()
    );
$$;
ALTER FUNCTION "public"."est_membre_salon"("salon" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;
ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."role_dans_salon"("salon" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select role from public.channel_members
    where channel_id = salon and user_id = auth.uid();
$$;
ALTER FUNCTION "public"."role_dans_salon"("salon" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."style_valide"("s" "jsonb", "salon" "uuid") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
    select case
        when jsonb_typeof(s) <> 'object' then false
        else not exists (
            select 1
            from jsonb_each(s) as e(cle, valeur)
            where jsonb_typeof(e.valeur) <> 'string'
               or case e.cle
                    when 'couleur_accent' then (e.valeur #>> '{}') !~ '^#[0-9a-fA-F]{6}$'
                    when 'couleur_fond' then (e.valeur #>> '{}') !~ '^#[0-9a-fA-F]{6}$'
                    when 'couleur_texte' then (e.valeur #>> '{}') !~ '^#[0-9a-fA-F]{6}$'
                    when 'image_fond' then (e.valeur #>> '{}') !~ ('^' || salon::text || '/[0-9a-f-]{36}\.(png|jpg|gif|webp)$')
                    else true
                  end
        )
    end;
$_$;
ALTER FUNCTION "public"."style_valide"("s" "jsonb", "salon" "uuid") OWNER TO "postgres";

SET default_tablespace = '';
SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."channel_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "inviter_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "invitee_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "channel_invitations_check" CHECK (("inviter_id" <> "invitee_id")),
    CONSTRAINT "channel_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'revoked'::"text"])))
);
ALTER TABLE "public"."channel_invitations" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."channel_members" (
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "channel_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);
ALTER TABLE "public"."channel_members" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "style" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    CONSTRAINT "channels_name_check" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 100))),
    CONSTRAINT "channels_style_check" CHECK ((("octet_length"(("style")::"text") <= 8192) AND "public"."style_valide"("style", "id")))
);
ALTER TABLE "public"."channels" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "requester_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "addressee_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contacts_check" CHECK (("requester_id" <> "addressee_id")),
    CONSTRAINT "contacts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text"])))
);
ALTER TABLE "public"."contacts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_content_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 4000)))
);
ALTER TABLE "public"."messages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_username_check" CHECK (("username" ~ '^[A-Za-z0-9_]{3,30}$'::"text"))
);
ALTER TABLE "public"."profiles" OWNER TO "postgres";
ALTER TABLE ONLY "public"."channel_invitations"
    ADD CONSTRAINT "channel_invitations_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_pkey" PRIMARY KEY ("channel_id", "user_id");
ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("requester_id", "addressee_id");
ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

CREATE INDEX "channel_invitations_invitee_idx" ON "public"."channel_invitations" USING "btree" ("invitee_id");
CREATE UNIQUE INDEX "channel_invitations_pending_unique" ON "public"."channel_invitations" USING "btree" ("channel_id", "invitee_id") WHERE ("status" = 'pending'::"text");
CREATE INDEX "channel_members_user_idx" ON "public"."channel_members" USING "btree" ("user_id");
CREATE UNIQUE INDEX "contacts_paire_unique" ON "public"."contacts" USING "btree" (LEAST("requester_id", "addressee_id"), GREATEST("requester_id", "addressee_id"));
CREATE INDEX "messages_channel_created_idx" ON "public"."messages" USING "btree" ("channel_id", "created_at");
CREATE UNIQUE INDEX "profiles_username_unique" ON "public"."profiles" USING "btree" ("lower"("username"));

CREATE OR REPLACE TRIGGER "on_channel_created" AFTER INSERT ON "public"."channels" FOR EACH ROW EXECUTE FUNCTION "public"."ajouter_proprietaire"();

ALTER TABLE ONLY "public"."channel_invitations"
    ADD CONSTRAINT "channel_invitations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."channel_invitations"
    ADD CONSTRAINT "channel_invitations_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."channel_invitations"
    ADD CONSTRAINT "channel_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "accepter une demande" ON "public"."contacts" FOR UPDATE TO "authenticated" USING ((("addressee_id" = "auth"."uid"()) AND ("status" = 'pending'::"text"))) WITH CHECK (("status" = 'accepted'::"text"));
CREATE POLICY "annuler une invitation" ON "public"."channel_invitations" FOR UPDATE TO "authenticated" USING ((("inviter_id" = "auth"."uid"()) AND ("status" = 'pending'::"text"))) WITH CHECK (("status" = 'revoked'::"text"));

ALTER TABLE "public"."channel_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."channel_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "créer un salon" ON "public"."channels" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));
CREATE POLICY "demander un contact" ON "public"."contacts" FOR INSERT TO "authenticated" WITH CHECK ((("requester_id" = "auth"."uid"()) AND ("status" = 'pending'::"text")));
CREATE POLICY "envoyer un message" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."est_membre_salon"("channel_id")));
CREATE POLICY "inviter un contact" ON "public"."channel_invitations" FOR INSERT TO "authenticated" WITH CHECK ((("inviter_id" = "auth"."uid"()) AND ("status" = 'pending'::"text") AND "public"."est_membre_salon"("channel_id") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."channel_members" "m"
  WHERE (("m"."channel_id" = "channel_invitations"."channel_id") AND ("m"."user_id" = "channel_invitations"."invitee_id"))))) AND (EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."status" = 'accepted'::"text") AND ((("c"."requester_id" = "auth"."uid"()) AND ("c"."addressee_id" = "channel_invitations"."invitee_id")) OR (("c"."addressee_id" = "auth"."uid"()) AND ("c"."requester_id" = "channel_invitations"."invitee_id"))))))));
CREATE POLICY "lire les messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ("public"."est_membre_salon"("channel_id"));

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modifier son profil" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));
CREATE POLICY "modifier un salon" ON "public"."channels" FOR UPDATE TO "authenticated" USING (("public"."role_dans_salon"("id") = 'owner'::"text")) WITH CHECK (("public"."role_dans_salon"("id") = 'owner'::"text"));

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profils lisibles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "quitter un salon" ON "public"."channel_members" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("role" <> 'owner'::"text")));
CREATE POLICY "refuser une invitation" ON "public"."channel_invitations" FOR UPDATE TO "authenticated" USING ((("invitee_id" = "auth"."uid"()) AND ("status" = 'pending'::"text"))) WITH CHECK (("status" = 'declined'::"text"));
CREATE POLICY "rejoindre un salon public" ON "public"."channel_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'member'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."channels" "c"
  WHERE (("c"."id" = "channel_members"."channel_id") AND "c"."is_public")))));
CREATE POLICY "supprimer un contact" ON "public"."contacts" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id")));
CREATE POLICY "supprimer un salon" ON "public"."channels" FOR DELETE TO "authenticated" USING (("public"."role_dans_salon"("id") = 'owner'::"text"));
CREATE POLICY "voir les membres de ses salons" ON "public"."channel_members" FOR SELECT TO "authenticated" USING ("public"."est_membre_salon"("channel_id"));
CREATE POLICY "voir les salons" ON "public"."channels" FOR SELECT TO "authenticated" USING (("is_public" OR ("created_by" = "auth"."uid"()) OR "public"."est_membre_salon"("id") OR (EXISTS ( SELECT 1
   FROM "public"."channel_invitations" "i"
  WHERE (("i"."channel_id" = "channels"."id") AND ("i"."invitee_id" = "auth"."uid"()) AND ("i"."status" = 'pending'::"text"))))));
CREATE POLICY "voir ses contacts" ON "public"."contacts" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id")));
CREATE POLICY "voir ses invitations" ON "public"."channel_invitations" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "inviter_id") OR ("auth"."uid"() = "invitee_id")));

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."channels";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
REVOKE ALL ON FUNCTION "public"."accepter_invitation"("invitation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accepter_invitation"("invitation_id" "uuid") TO "authenticated";
REVOKE ALL ON FUNCTION "public"."est_membre_salon"("salon" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."est_membre_salon"("salon" "uuid") TO "authenticated";
REVOKE ALL ON FUNCTION "public"."role_dans_salon"("salon" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."role_dans_salon"("salon" "uuid") TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."channel_invitations" TO "service_role";
GRANT SELECT ON TABLE "public"."channel_invitations" TO "authenticated";
GRANT INSERT("channel_id") ON TABLE "public"."channel_invitations" TO "authenticated";
GRANT INSERT("invitee_id") ON TABLE "public"."channel_invitations" TO "authenticated";
GRANT UPDATE("status") ON TABLE "public"."channel_invitations" TO "authenticated";
GRANT UPDATE("responded_at") ON TABLE "public"."channel_invitations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."channel_members" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."channel_members" TO "authenticated";
GRANT INSERT("channel_id") ON TABLE "public"."channel_members" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."channels" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."channels" TO "authenticated";
GRANT INSERT("name"),UPDATE("name") ON TABLE "public"."channels" TO "authenticated";
GRANT INSERT("style"),UPDATE("style") ON TABLE "public"."channels" TO "authenticated";
GRANT INSERT("is_public"),UPDATE("is_public") ON TABLE "public"."channels" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."contacts" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."contacts" TO "authenticated";
GRANT INSERT("addressee_id") ON TABLE "public"."contacts" TO "authenticated";
GRANT UPDATE("status") ON TABLE "public"."contacts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."messages" TO "service_role";
GRANT SELECT ON TABLE "public"."messages" TO "authenticated";
GRANT INSERT("channel_id") ON TABLE "public"."messages" TO "authenticated";
GRANT INSERT("content") ON TABLE "public"."messages" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";
GRANT UPDATE("username") ON TABLE "public"."profiles" TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";
