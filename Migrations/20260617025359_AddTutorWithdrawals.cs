using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace inMVC.Migrations
{
    /// <inheritdoc />
    public partial class AddTutorWithdrawals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WithdrawalId",
                table: "TutorPayouts",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TutorWithdrawals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TutorId = table.Column<int>(type: "INTEGER", nullable: false),
                    Amount = table.Column<decimal>(type: "TEXT", nullable: false),
                    Method = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    AdminNote = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TutorWithdrawals", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TutorPayouts_WithdrawalId",
                table: "TutorPayouts",
                column: "WithdrawalId");

            migrationBuilder.Sql("""
                UPDATE TutorPayouts
                SET Status = 'Held'
                WHERE Status = 'Pending'
                  AND GrossAmount > 0
                  AND EXISTS (
                      SELECT 1
                      FROM Bookings
                      WHERE Bookings.Id = TutorPayouts.BookingId
                        AND Bookings.Status <> 'Completed'
                  )
                """);

            migrationBuilder.Sql("""
                UPDATE TutorPayouts
                SET
                    PlatformFeeAmount = ROUND((GrossAmount + CompensationAmount) * 0.10, 2),
                    NetAmount = CASE
                        WHEN ((GrossAmount + CompensationAmount) - ROUND((GrossAmount + CompensationAmount) * 0.10, 2) - FineAmount) < 0
                        THEN 0
                        ELSE ((GrossAmount + CompensationAmount) - ROUND((GrossAmount + CompensationAmount) * 0.10, 2) - FineAmount)
                    END
                WHERE PlatformFeeAmount = 0
                  AND (GrossAmount + CompensationAmount) > 0
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TutorWithdrawals");

            migrationBuilder.DropIndex(
                name: "IX_TutorPayouts_WithdrawalId",
                table: "TutorPayouts");

            migrationBuilder.DropColumn(
                name: "WithdrawalId",
                table: "TutorPayouts");
        }
    }
}
