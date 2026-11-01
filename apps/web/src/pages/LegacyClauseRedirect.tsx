import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

/** /bids/:id/compliance/:itemId (retired review page) -> the clause in the workspace. */
export const LegacyClauseRedirect: React.FC = () => {
  const { id = '', itemId = '' } = useParams<{ id: string; itemId: string }>();
  return <Navigate to={`/bids/${id}/clauses?clause=${encodeURIComponent(itemId)}`} replace />;
};
