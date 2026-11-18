// Keep the confirmation beneath its choice without overflowing a narrow screen.
export function confirmationLeft(
  choiceLeft,
  choiceWidth,
  buttonWidth,
  containerWidth,
  index,
  count,
) {
  const desired =
    index === 0
      ? choiceLeft
      : index === count - 1
        ? choiceLeft + choiceWidth - buttonWidth
        : choiceLeft + (choiceWidth - buttonWidth) / 2;
  return Math.max(
    0,
    Math.min(desired, Math.max(0, containerWidth - buttonWidth)),
  );
}

export function activeConfirmation(pending) {
  const key = Object.keys(pending).find((key) =>
    Number.isInteger(pending[key]),
  );
  return key === undefined ? null : Number(key);
}
