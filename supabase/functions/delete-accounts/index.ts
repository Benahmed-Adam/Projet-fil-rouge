import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

export default {
    fetch: withSupabase(
        { auth: "user" },
        async (req, { supabase, supabaseAdmin }) => {
            if (req.method !== "POST") {
                return Response.json({ error: "Méthode non autorisée." }, { status: 405 });
            }

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                return Response.json({ error: "Non authentifié." }, { status: 401 });
            }

            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

            if (deleteError) {
                console.error("Erreur suppression utilisateur :", deleteError);
                return Response.json(
                    { error: "Impossible de supprimer le compte." },
                    { status: 500 },
                );
            }

            return Response.json({ message: "Compte supprimé." });
        },
    ),
};