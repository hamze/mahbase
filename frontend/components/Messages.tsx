export function Messages({ errors, notice }: { errors: string[]; notice?: string }) {
  return (
    <>
      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {notice && <p className="notice">{notice}</p>}
    </>
  );
}
