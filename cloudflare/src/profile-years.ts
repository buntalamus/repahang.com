/** Stored historical years take precedence; verified application history fills gaps. */
export function qualificationYearsSql(alias = "u"): string {
  return (["3", "1"] as const)
    .flatMap((grade) => {
      const types =
        grade === "3" ? "'kelas3_fam','ujian_bertulis'" : "'ujian_kelas1_fam'";
      return ["mohon", "lulus"].map((stage) => {
        const field = `tahun_${stage}_kelas${grade}`;
        return `COALESCE(NULLIF(NULLIF(trim(${alias}.${field}),''),'0000'),(SELECT MIN(p.tahun_permohonan) FROM permohonan p
        WHERE p.user_id=${alias}.id AND p.jenis_borang IN (${types})
        ${stage === "lulus" ? "AND p.status_ujian='Lulus'" : ""})) AS ${field}`;
      });
    })
    .join(",\n");
}
