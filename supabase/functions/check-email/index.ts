import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Método não permitido",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const body = await req.json();
    const email = body?.email;

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({
          error: "E-mail inválido",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("ADMIN_API_KEY")!,
    );

    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data, error } =
        await supabase.auth.admin.listUsers({
          page,
          perPage,
        });

      if (error) {
        console.error(
          "[check-email] Erro ao consultar usuários:",
          error,
        );

        return new Response(
          JSON.stringify({
            error: "Erro interno",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      const exists = data.users.some(
        (user) =>
          user.email?.trim().toLowerCase() === normalizedEmail,
      );

      if (exists) {
        return new Response(
          JSON.stringify({
            exists: true,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (data.users.length < perPage) {
        break;
      }

      page++;
    }

    return new Response(
      JSON.stringify({
        exists: false,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(
      "[check-email] Erro inesperado:",
      error,
    );

    return new Response(
      JSON.stringify({
        error: "Erro interno",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});