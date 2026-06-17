using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace inMVC.Migrations
{
    /// <inheritdoc />
    public partial class AddGcashWithdrawalAccountColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GCashAccountName",
                table: "TutorWithdrawals",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "GCashAccountNumber",
                table: "TutorWithdrawals",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GCashAccountName",
                table: "TutorWithdrawals");

            migrationBuilder.DropColumn(
                name: "GCashAccountNumber",
                table: "TutorWithdrawals");
        }
    }
}
