'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export type Me = {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'OFFICER' | 'LSG_ADMIN';
  collegeId: string | null;
  college: { code: string; name: string } | null;
  profile: { id: string } | null;
};

/** Loads the signed-in user. `me` is null when nobody is signed in. */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Me>('/auth/me')
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  return { me, loading };
}
