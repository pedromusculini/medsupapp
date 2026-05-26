import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session }) {
      if (session.user) {
        (session.user as any).role = "medico"; // Temporário
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

export const { GET, POST } = handlers;