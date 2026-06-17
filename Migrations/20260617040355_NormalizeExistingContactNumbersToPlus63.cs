using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace inMVC.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeExistingContactNumbersToPlus63 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            NormalizeContactColumn(migrationBuilder, "LearnerProfiles", "ContactNumber");
            NormalizeContactColumn(migrationBuilder, "LearnerProfiles", "GuardianContactNumber");
            NormalizeContactColumn(migrationBuilder, "TutorProfiles", "ContactNumber");
            NormalizeContactColumn(migrationBuilder, "Bookings", "LearnerContact");
            NormalizeContactColumn(migrationBuilder, "TutorWithdrawals", "GCashAccountNumber");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }

        private static void NormalizeContactColumn(MigrationBuilder migrationBuilder, string tableName, string columnName)
        {
            var compact = $"replace(replace(replace(trim({columnName}), ' ', ''), '-', ''), '+', '')";

            migrationBuilder.Sql($"""
                UPDATE {tableName}
                SET {columnName} = CASE
                    WHEN length({compact}) = 12 AND substr({compact}, 1, 3) = '639' AND {compact} NOT GLOB '*[^0-9]*'
                        THEN '+' || {compact}
                    WHEN length({compact}) = 11 AND substr({compact}, 1, 2) = '09' AND {compact} NOT GLOB '*[^0-9]*'
                        THEN '+63' || substr({compact}, 2)
                    WHEN length({compact}) = 10 AND substr({compact}, 1, 1) = '9' AND {compact} NOT GLOB '*[^0-9]*'
                        THEN '+63' || {compact}
                    ELSE {columnName}
                END
                WHERE {columnName} IS NOT NULL
                  AND trim({columnName}) <> ''
                """);
        }
    }
}
