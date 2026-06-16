using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace inMVC.Migrations
{
    /// <inheritdoc />
    public partial class RemoveBookingLearnerGrade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LearnerGrade",
                table: "Bookings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LearnerGrade",
                table: "Bookings",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }
    }
}
