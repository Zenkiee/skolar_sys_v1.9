using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace inMVC.Migrations
{
    /// <inheritdoc />
    public partial class AddTutorTeachingHours : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "TotalHoursTaught",
                table: "TutorProfiles",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.Sql("""
                UPDATE TutorProfiles
                SET TotalHoursTaught = COALESCE((
                    SELECT SUM(DurationHours)
                    FROM Bookings
                    WHERE Bookings.TutorId = TutorProfiles.Id
                      AND Bookings.Status = 'Completed'
                ), 0)
                """);

            migrationBuilder.Sql("""
                UPDATE TutorPayouts
                SET
                    PlatformFeeAmount = ROUND(
                        (GrossAmount + CompensationAmount) *
                        CASE
                            WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 150 THEN 0.15
                            WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 125 THEN 0.20
                            WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 100 THEN 0.25
                            WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 75 THEN 0.30
                            ELSE 0.35
                        END,
                        2
                    ),
                    NetAmount = CASE
                        WHEN (
                            (GrossAmount + CompensationAmount) -
                            ROUND(
                                (GrossAmount + CompensationAmount) *
                                CASE
                                    WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 150 THEN 0.15
                                    WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 125 THEN 0.20
                                    WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 100 THEN 0.25
                                    WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 75 THEN 0.30
                                    ELSE 0.35
                                END,
                                2
                            ) -
                            FineAmount
                        ) < 0 THEN 0
                        ELSE (
                            (GrossAmount + CompensationAmount) -
                            ROUND(
                                (GrossAmount + CompensationAmount) *
                                CASE
                                    WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 150 THEN 0.15
                                    WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 125 THEN 0.20
                                    WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 100 THEN 0.25
                                    WHEN COALESCE((SELECT TotalHoursTaught FROM TutorProfiles WHERE TutorProfiles.Id = TutorPayouts.TutorId), 0) >= 75 THEN 0.30
                                    ELSE 0.35
                                END,
                                2
                            ) -
                            FineAmount
                        )
                    END
                WHERE (GrossAmount + CompensationAmount) > 0
                  AND WithdrawalId IS NULL
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalHoursTaught",
                table: "TutorProfiles");
        }
    }
}
